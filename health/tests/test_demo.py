"""Integration checks that do not require a network listener."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import gravsim as gs
from gravsim.queue import Queue
from gravsim.serve import data_routes
from healthservice.alerts import Alert
from healthservice.demo import DemoWorker, recipients
from healthservice.sources import DataServiceSource, mission_info


class LocalSource(DataServiceSource):
    def __init__(self, mission, data, day):
        self._mission = mission_info(mission)
        self._crew = [gs_crew(c) for c in mission.crew]
        self.routes = data_routes(mission, data, lambda: day)

    def _request(self, method, path, query=None, body=None):
        return self.routes[method, path](query or {}, body)[1]


def gs_crew(crew):
    from healthservice.models import CrewInfo
    return CrewInfo(crew.id, crew.sex)


class DemoTests(unittest.TestCase):
    def test_persistence_and_independent_cursors(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = str(Path(tmp) / 'data.sqlite')
            data = gs.DataService(store=gs.SqliteStore(path))
            readings = data.ingest([{'crew_id': 'CM-1', 'measure': 'resting_hr',
                                     'timestamp': '2027-06-01T09:30:00Z', 'value': 70, 'unit': 'bpm'}])
            data.save_result('CM-1', 'study', '2027-06-01T09:30:00Z', {'study': 'test'})
            data.ingest_context([{'crew_id': 'CM-1', 'start': '2027-06-01T09:00:00Z', 'end': '2027-06-01T10:00:00Z', 'activity': 'work', 'source': 'timeline'}])
            reopened = gs.DataService(store=gs.SqliteStore(path))
            self.assertEqual(reopened.readings('CM-1'), readings)
            self.assertEqual(reopened.results('CM-1')[0].payload, {'study': 'test'})
            self.assertEqual(reopened.current_context('CM-1', '2027-06-01T09:30:00Z').activity, 'work')
            data.store.close()
            reopened.store.close()
            q = Queue(str(Path(tmp) / 'queue.sqlite'))
            q.publish('test', {'x': 1}, dedupe='one')
            q.publish('test', {'x': 1}, dedupe='one')
            first = q.next('a', 'events')
            self.assertEqual(q.next('a', 'events'), first)  # a failed consumer retries until it acknowledges
            q.ack('a', first[0])
            self.assertIsNone(q.next('a', 'events'))
            self.assertEqual(q.next('b', 'events'), first)

    def test_event_to_results_study_and_delivery(self):
        with tempfile.TemporaryDirectory() as tmp:
            queue = Queue(str(Path(tmp) / 'queue.sqlite'))
            mission = gs.Mission.random('iss_180', n_crew=2, seed=7)
            data = gs.DataService(publisher=queue)
            data.ingest(mission.timeline(seed=7, until=95))
            data.ingest_context(mission.context())
            source = LocalSource(mission, data, 95)
            worker = DemoWorker(source, queue)
            alert = Alert('CM-1', 'knee_extension_60', 'warning', 'Test', 95, mission.timestamp(95), True)
            with patch('healthservice.demo.check', return_value={'knee_extension_60': alert}):
                for _ in range(20):
                    worker.step()
            self.assertTrue(data.results('CM-1', 'measure_results'))
            self.assertTrue(data.results('CM-1', 'study'))
            self.assertTrue(queue.deliveries())
            before = len(queue.deliveries())
            worker.process_readings({'crew_id': 'CM-1'})
            for _ in range(20):
                worker.step()
            self.assertEqual(len(queue.deliveries()), before)
            worker.schedule_routine()
            self.assertTrue(any(s['study'] == 'strength' for r in data.results('CM-1', 'study') for s in r.payload['studies']))
            studies = [r.to_dict() for r in data.results('CM-1', 'study')]
            worker.schedule_routine()
            self.assertEqual([r.to_dict() for r in data.results('CM-1', 'study')], studies)
            data.store.close()

    def test_alert_carries_where_the_crew_is_and_the_phase(self):
        for eva in (False, True):
            with self.subTest(eva=eva), tempfile.TemporaryDirectory() as tmp:
                queue = Queue(str(Path(tmp) / 'queue.sqlite'))
                mission = gs.Mission.random('iss_180', n_crew=2, seed=7)
                now = mission.timestamp(95)
                if eva:   # CM-1 outside on a spacewalk at the mission clock's "now"
                    hour = int(now[11:13]) + int(now[14:16]) / 60
                    mission.crew[0].add_eva(95, start_hour=hour - 1, hours=3)
                data = gs.DataService(publisher=queue)
                data.ingest(mission.timeline(seed=7, until=95))
                data.ingest_context(mission.context())
                worker = DemoWorker(LocalSource(mission, data, 95), queue)
                alert = Alert('CM-1', 'knee_extension_60', 'warning', 'Test', 95, now, True)
                with patch('healthservice.demo.check', return_value={'knee_extension_60': alert}):
                    worker.process_readings({'crew_id': 'CM-1'})
                published = []
                while item := queue.next('t', 'notifications'):
                    queue.ack('t', item[0])
                    published.append(item)
                body = next(b for _, topic, b in published if topic == 'health.alert')
                crew = [c for c in body['notify'] if c != 'ship_center']
                self.assertEqual(set(body['context']), {'CM-1', *crew})
                for crew_id, where in body['context'].items():
                    expected = data.current_context(crew_id, now).to_dict()
                    del expected['crew_id']
                    self.assertEqual(where, expected)
                self.assertEqual(body['phase'], {'name': 'flight', 'gravity_g': 0.0})
                if eva:
                    self.assertEqual((body['context']['CM-1']['activity'], body['context']['CM-1']['location']),
                                     ('eva', 'outside'))
                    self.assertEqual(body['notify'], ['CM-2', 'ship_center'])
                data.store.close()

    def test_routing_unavailable_and_unknown(self):
        class Source:
            def __init__(self, contexts): self.contexts = contexts
            def crew(self):
                from healthservice.models import CrewInfo
                return [CrewInfo('CM-1', 'F'), CrewInfo('CM-2', 'M')]
            def _request(self, method, path, query): return self.contexts[query['crew']]
        for activity in ('eva', 'sleep', 'hygiene'):
            people, _ = recipients(Source({'CM-1': {'activity': activity}, 'CM-2': {'activity': 'work'}}), 'CM-1')
            self.assertEqual(people, ['CM-2', 'ship_center'])
        people, _ = recipients(Source({'CM-1': None, 'CM-2': {'activity': 'sleep'}}), 'CM-1')
        self.assertEqual(people, ['ship_center'])


if __name__ == '__main__':
    unittest.main()
