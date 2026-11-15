import json
import tempfile
import threading
import unittest
from pathlib import Path
from urllib.request import urlopen
from notification_center.core import NotificationCenter
from notification_center.fixtures import make_scenario
from notification_center.latency import HorizonsLatency
from notification_center.server import make_server
from test_center import eventually

class DelayTests(unittest.TestCase):
    def test_current_planner_messages_cross_shared_queue(self):
        import gravsim as gs
        from types import SimpleNamespace
        from gravsim.queue import Queue
        from healthservice.sources import mission_info
        from planner.service import Planner
        from notification_center.bridge import QueueBridge
        mission=mission_info(gs.Mission('mars'))
        source=SimpleNamespace(mission=lambda:mission, current_day=lambda:300,
            crew=lambda:[SimpleNamespace(id='CM-1')],
            _request=lambda *args:{'activity':'work','location':'operations'})
        with tempfile.TemporaryDirectory() as temp:
            center=NotificationCenter(Path(temp)/'local.db')
            queue=Queue(str(Path(temp)/'shared.db'))
            try:
                bridge=QueueBridge(center,queue,source)
                for kind in ('plan_reminder','plan_missed'):
                    item={'id':kind,'type':'study','title':'Strength assessment','routine_id':'6025',
                          'ref':'6025','measure':'knee_extension_60','window':{'day_from':300,'day_to':301},'status':'booked'}
                    payload=Planner._message(kind,'CM-1',item,mission.timestamp(300),['CM-1','ship_center'] if kind=='plan_missed' else ['CM-1'])
                    queue.publish(kind.replace('_','.'),payload,channel='notifications')
                    self.assertTrue(bridge.step())
                center.tick()
                eventually(lambda:len(center.inbox('CM-1'))==2)
                self.assertEqual(center.db.execute('SELECT COUNT(*) FROM rejected_messages').fetchone()[0],0)
                self.assertTrue(any(r['channel']=='ship_center' for r in center.deliveries()))
            finally:center.close()

    def test_restart_preserves_timer_and_disconnected_link_never_confirms(self):
        now=[100.0]
        plan=lambda channel, location: {'one_way_seconds':2, 'confirmation_seconds':4, 'source':'test'}
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'n.db'
            center=NotificationCenter(path,latency=plan,clock=lambda:now[0])
            center.publish(make_scenario('mild','CM-1'));center.tick()
            eventually(lambda:all(r['status']=='in_transit' for r in center.deliveries()))
            earth=next(r for r in center.deliveries() if r['channel']=='earth')
            center.close()
            center=NotificationCenter(path,latency=plan,clock=lambda:now[0])
            try:
                center.set_channel('earth',False);now[0]=105;center.tick()
                self.assertIsNone(center.result('earth',earth['id'])['return'])
                center.set_channel('earth',True);center.tick()
                self.assertTrue(center.result('earth',earth['id'])['return'])
                self.assertEqual(len(center.outputs('earth','mission-control')),1)
            finally:center.close()

    def test_four_seconds_roundtrip_and_all_channel_endpoints(self):
        now = [100.0]
        def fake(params):
            return {'result': '$$SOE\n2460000, date, 1,2,3,4,5,6,1200,7,8,\n$$EOE'}
        latency = HorizonsLatency(fetch=fake)
        with tempfile.TemporaryDirectory() as temp:
            center = NotificationCenter(Path(temp)/'n.db', latency=latency, clock=lambda: now[0])
            server = make_server(center,0)
            thread = threading.Thread(target=server.serve_forever,daemon=True); thread.start()
            try:
                message = make_scenario('eva','CM-1')
                center.publish(message); center.tick()
                eventually(lambda: all(r['status']=='in_transit' for r in center.deliveries()))
                earth = next(r for r in center.deliveries() if r['channel']=='earth')
                self.assertIsNone(center.result('earth',earth['id'])['return'])
                now[0]=100.2; center.tick()
                for row in center.deliveries():
                    with urlopen(f"http://127.0.0.1:{server.server_port}/api/v1/outputs/{row['channel']}/{row['id']}") as response:
                        result=json.load(response)
                    self.assertEqual(result['return'], None if row['channel']=='earth' else True)
                now[0]=102; center.tick()
                result=center.result('earth',earth['id'])
                self.assertTrue(result['destination_received']); self.assertIsNone(result['return'])
                now[0]=104; center.tick()
                self.assertTrue(center.result('earth',earth['id'])['return'])
                self.assertEqual(result['delay']['confirmation_seconds'],4)
            finally:
                server.shutdown(); thread.join(); server.server_close(); center.close()

    def test_unknown_location_keeps_earth_pending_without_blocking_local(self):
        with tempfile.TemporaryDirectory() as temp:
            now=[0.0]
            center=NotificationCenter(Path(temp)/'n.db',latency=HorizonsLatency(),clock=lambda:now[0])
            try:
                msg=make_scenario('mild','CM-1');msg['mission_location']={'mode':'unavailable'}
                center.publish(msg);center.tick()
                eventually(lambda:any(r['status']=='waiting_link' for r in center.deliveries()))
                eventually(lambda:any(r['status']=='in_transit' for r in center.deliveries()))
                now[0]=.2;center.tick()
                self.assertTrue(center.inbox('CM-1'))
                self.assertFalse(center.outputs('earth','mission-control'))
            finally: center.close()

    def test_shared_queue_health_contract_and_durable_ack(self):
        from gravsim.queue import Queue
        from notification_center.bridge import QueueBridge
        from healthservice import notices
        with tempfile.TemporaryDirectory() as temp:
            # Use a real producer payload supplied by its contract tests' mission shape.
            queue=Queue(str(Path(temp)/'shared.db'))
            center=NotificationCenter(Path(temp)/'local.db')
            try:
                import gravsim as gs
                from healthservice.sources import mission_info
                mission=mission_info(gs.Mission('mars'))
                message=notices.build(notification_id='health:test:1', revision=1, source_event_id='test:1',
                    mission=mission, mission_id='mars', crew_id='CM-1', crew_ids=['CM-1','CM-2','CM-3'],
                    contexts={'CM-1':{'activity':'eva'},'CM-2':{'activity':'work'},'CM-3':{'activity':'work'}},
                    day=300, priority='critical', title='Private clinical title', message='Private clinical detail',
                    created_at=mission.timestamp(300))
                notices.publish(queue,message | {'mission_location':message['mission_location']})
                bridge=QueueBridge(center,queue)
                self.assertTrue(bridge.step())
                self.assertIsNone(queue.next(bridge.consumer,'notifications'))
                center.tick(); eventually(lambda:center.inbox('CM-1'))
                eventually(lambda:center.inbox('CM-2'))
                self.assertEqual(center.inbox('CM-2')[0]['title'],'Aviso operacional')
                self.assertFalse(bridge.step())
                queue.publish('health.notice',{'bad':True},channel='notifications')
                bridge.step()
                self.assertEqual(center.db.execute('SELECT COUNT(*) FROM rejected_messages').fetchone()[0],1)
            finally: center.close()
