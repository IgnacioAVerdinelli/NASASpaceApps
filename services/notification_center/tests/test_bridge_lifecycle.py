import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
import gravsim as gs
from gravsim.queue import Queue
from healthservice.sources import DataServiceError, mission_info
from notification_center.bridge import QueueBridge
from notification_center.core import NotificationCenter
from notification_center.fixtures import make_scenario
from test_center import eventually


class BridgeReviewTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.center = NotificationCenter(Path(self.temp.name) / 'local.db')
        self.addCleanup(lambda: self.center.close())
        self.queue = Queue(str(Path(self.temp.name) / 'shared.db'))
        self.status = 'booked'
        self.offline = False
        self.mission = mission_info(gs.Mission('mars'))
        self.source = SimpleNamespace(mission=lambda: self.mission, current_day=lambda: 300,
            crew=lambda: [SimpleNamespace(id='CM-1')], _request=self.request)
        self.bridge = QueueBridge(self.center, self.queue, self.source)

    def request(self, method, path, query):
        if self.offline:
            raise DataServiceError('temporary outage')
        if path == '/api/v1/results':
            return [{'model_version':'planner-1', 'payload':{'items':[{'id':'test-1','status':self.status}]}}]
        return {'activity':'work','location':'operations'}

    def body(self, missed=False):
        return {'type':'plan_missed' if missed else 'plan_reminder', 'crew_id':'CM-1',
            'created_at':self.mission.timestamp(300), 'synthetic':True, 'notify':['CM-1'],
            'item':{'id':'test-1','title':'Strength assessment','status':'missed' if missed else 'booked','window':{}}}

    def send_reminder(self):
        self.queue.publish('plan.reminder', self.body(), channel='notifications')
        self.bridge.step(); self.center.tick()
        eventually(lambda:self.center.inbox('CM-1'))

    def test_malformed_planner_payloads_do_not_block_later_critical_notice(self):
        for bad in ({}, None, [], {'item':None}, {**self.body(), 'notify':3},
                    {**self.body(), 'item':{'id':[]}}, {**self.body(), 'created_at':'invalid'}):
            self.queue.publish('plan.reminder',bad,channel='notifications')
            self.assertTrue(self.bridge.step())
        self.queue.publish('health.notice',make_scenario('critical','CM-1'),channel='notifications')
        self.assertTrue(self.bridge.step()); self.center.tick()
        eventually(lambda:self.center.inbox('CM-1'))
        self.assertEqual(self.center.inbox('CM-1')[0]['priority'],'critical')
        self.assertEqual(self.center.db.execute('SELECT COUNT(*) FROM rejected_messages').fetchone()[0],7)

    def test_dataservice_failure_keeps_cursor_for_retry_and_does_not_reject(self):
        self.queue.publish('plan.reminder',self.body(),channel='notifications')
        self.offline=True
        with self.assertRaises(DataServiceError):self.bridge.step()
        self.assertIsNotNone(self.queue.next(self.bridge.consumer,'notifications'))
        self.assertEqual(self.center.db.execute('SELECT COUNT(*) FROM rejected_messages').fetchone()[0],0)
        self.offline=False;self.assertTrue(self.bridge.step())
        self.assertIsNone(self.queue.next(self.bridge.consumer,'notifications'))

    def test_completion_after_restart_removes_card_and_retries_reconciliation(self):
        self.send_reminder()
        self.center.close()
        self.center=NotificationCenter(Path(self.temp.name)/'local.db')
        self.bridge=QueueBridge(self.center,self.queue,self.source)
        self.status='done';self.offline=True
        with self.assertRaises(DataServiceError):self.bridge.reconcile()
        self.assertTrue(self.center.inbox('CM-1'))
        self.offline=False;self.bridge.reconcile();self.center.tick()
        self.assertEqual(self.center.inbox('CM-1'),[])
        self.assertTrue(any(json.loads(r[0])['state']=='resolved' for r in self.center.db.execute('SELECT payload FROM messages')))

    def test_missed_supersedes_reminder_and_cancel_retires_missed_notice(self):
        self.send_reminder();self.status='missed'
        self.queue.publish('plan.missed',self.body(True),channel='notifications')
        self.bridge.step();self.center.tick()
        eventually(lambda:any(n['kind']=='plan_missed' for n in self.center.inbox('CM-1')))
        self.assertEqual([n['kind'] for n in self.center.inbox('CM-1')],['plan_missed'])
        self.status='cancelled';self.bridge.reconcile();self.center.tick()
        self.assertEqual(self.center.inbox('CM-1'),[])

    def test_delayed_reminder_for_already_completed_task_is_never_shown(self):
        self.status='done'
        self.queue.publish('plan.reminder',self.body(),channel='notifications')
        self.bridge.step();self.center.tick()
        eventually(lambda:all(r['status']=='delivered' for r in self.center.deliveries()))
        self.assertEqual(self.center.inbox('CM-1'),[])
