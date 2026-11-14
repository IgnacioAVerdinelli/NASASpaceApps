"""Local event workers: processing, study scheduling and simulated delivery."""
from __future__ import annotations

import argparse
import logging
import time

from gravsim.queue import Queue
from gravsim.schedule import nasa_days

from .alerts import check
from .processing import compute_results
from .reference import Reference
from .sources import DataServiceSource

log = logging.getLogger(__name__)
VERSION = 'demo-scheduler-1'
UNAVAILABLE = {'eva', 'hygiene', 'sleep'}
STUDIES = {'dxa': 'bone_densitometry', 'dynamometer': 'strength', 'cycle': 'aerobic_capacity'}


def recipients(source, subject):
    contexts = {}
    for crew in source.crew():
        contexts[crew.id] = source._request('GET', '/api/v1/context/current', {'crew': crew.id})
    context = contexts.get(subject)
    if context and context['activity'] not in UNAVAILABLE:
        return [subject, 'ship_center'], f'{subject} available'
    other = next((c.id for c in source.crew() if c.id != subject and contexts[c.id]
                  and contexts[c.id]['activity'] not in UNAVAILABLE), None)
    return ([other, 'ship_center'] if other else ['ship_center'],
            f"{subject} unavailable: {context['activity'] if context else 'unknown context'}")


class DemoWorker:
    def __init__(self, source, queue):
        self.source, self.queue = source, queue
        self.reference = Reference.load()

    def process_readings(self, message):
        crew = next(c for c in self.source.crew() if c.id == message['crew_id'])
        mission = self.source.mission()
        day = min(self.source.current_day(), mission.day_of(message['end'])) if message.get('end') else self.source.current_day()
        readings = self.source.readings(crew.id, day)
        results = compute_results(self.reference, mission, crew, readings, day)
        self.source.save_results(results)
        for measure, alert in check(self.reference, mission, results).items():
            result = next(r for r in results if r.measure == measure)
            key = f'{crew.id}:{measure}:{result.last_reading_at}'
            finding = {'type': 'finding', 'crew_id': crew.id, 'measure': measure,
                       'change_pct': result.change_pct, 'typical_no_exercise_pct': result.typical_no_exercise_pct,
                       'mission_day': day, 'synthetic': alert.synthetic}
            self.queue.publish('health.finding', finding, dedupe=f'finding:{key}')
            notify, reason = recipients(self.source, crew.id)
            payload = {'type': 'alert', 'subject_crew_id': crew.id, 'notify': notify,
                       'routing_reason': reason, **alert.to_dict()}
            self.queue.publish('health.alert', payload, channel='notifications', dedupe=f'alert:{key}')

    def save_study(self, crew, day, study):
        mission = self.source.mission()
        stamp = mission.timestamp(day)
        records = self.source._request('GET', '/api/v1/results', {'crew': crew, 'kind': 'study'})
        previous = next((r for r in records if r['timestamp'] == stamp and r['model_version'] == VERSION), None)
        studies = list(previous['payload']['studies']) if previous else []
        if any(s['id'] == study['id'] for s in studies):
            return
        studies.append(study)
        self.source._request('POST', '/api/v1/results', body={'crew_id': crew, 'kind': 'study',
                             'timestamp': stamp, 'model_version': VERSION, 'payload': {'studies': studies}})

    def schedule_routine(self):
        mission, now = self.source.mission(), self.source.current_day()
        for crew in self.source.crew():
            records = self.source._request('GET', '/api/v1/results', {'crew': crew.id, 'kind': 'study'})
            existing = {s['id'] for r in records if r['model_version'] == VERSION for s in r['payload']['studies']}
            for instrument, name in STUDIES.items():
                for day in nasa_days(mission, instrument):
                    identifier = f'{name}:{day}'
                    if day >= now and identifier not in existing:
                        self.save_study(crew.id, day, {'id': identifier, 'study': name, 'status': 'scheduled', 'reason': 'routine'})
            records = self.source._request('GET', '/api/v1/results', {'crew': crew.id, 'kind': 'study'})
            for record in records:
                if record['model_version'] != VERSION or mission.day_of(record['timestamp']) > now:
                    continue
                for study in record['payload']['studies']:
                    payload = {'type': 'study_due', 'crew_id': crew.id, 'study': study,
                               'timestamp': record['timestamp'], 'notify': [crew.id, 'ship_center'], 'synthetic': True}
                    self.queue.publish('study.due', payload, channel='notifications', dedupe=f"study:{crew.id}:{study['id']}")

    def handle_finding(self, finding):
        day = min(self.source.mission().end, self.source.current_day() + 1)
        identifier = f"extra:{finding['measure']}:{finding['mission_day']}"
        self.save_study(finding['crew_id'], day, {'id': identifier, 'study': 'retest',
                        'measure': finding['measure'], 'status': 'scheduled', 'reason': 'finding'})

    def consume(self, consumer, channel, handler):
        item = self.queue.next(consumer, channel)
        if not item:
            return False
        message_id, topic, body = item
        handler(message_id, topic, body)
        self.queue.ack(consumer, message_id)
        return True

    def step(self):
        self.consume('health', 'events', lambda _, topic, body: self.process_readings(body) if topic == 'data.readings_stored' else None)
        self.consume('scheduler', 'events', lambda _, topic, body: self.handle_finding(body) if topic == 'health.finding' else None)
        self.consume('notifications', 'notifications', lambda mid, _, body: [self.queue.deliver(mid, recipient, body) for recipient in body['notify']])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-url', default='http://localhost:8000')
    parser.add_argument('--queue', required=True)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO)
    worker = DemoWorker(DataServiceSource(args.data_url), Queue(args.queue))
    last_schedule = 0.0
    while True:
        try:
            worker.step()
            if time.monotonic() - last_schedule >= 5:
                worker.schedule_routine()
                last_schedule = time.monotonic()
        except Exception:
            log.exception('Demo worker failed; retrying')
        time.sleep(0.25)


if __name__ == '__main__':
    main()
