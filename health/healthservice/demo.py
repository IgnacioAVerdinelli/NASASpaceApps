"""Local event workers: processing, health notices and simulated delivery.

Study scheduling moved to the Planner (planner/, docs/planner.md): it consumes the `health.finding` messages
this worker publishes and books retests and reviews.
"""
from __future__ import annotations

import argparse
import logging
import os
import time

from gravsim.queue import Queue

from . import findings, notices
from .alerts import check
from .processing import MEASURES as PROCESSED, compute_results
from . import vitals
from .service import vitals_inputs
from .reference import Reference
from .sources import DataServiceSource

log = logging.getLogger(__name__)
PRIORITY = {'info': 'info', 'warning': 'warning', 'critical': 'critical'}   # alert severity -> notice priority


def crew_contexts(source):
    """The DataService's current context record of each crew member, by crew id (None if nothing covers now)."""
    return {crew.id: source._request('GET', '/api/v1/context/current', {'crew': crew.id}) for crew in source.crew()}


def measure_of(notice):
    """The measure a notice is about (the topic inside its id)."""
    return notice['notification_id'].split('|')[3]


class DemoWorker:
    def __init__(self, source, queue):
        self.source, self.queue = source, queue
        self.reference = Reference.load()
        self.notices = notices.NoticeStore(source)
        self.findings = findings.FindingStore(source)

    def _notice(self, *, previous, crew_id, measure, priority, title, message, created_at, event, contexts, now,
                synthetic, state='active'):
        mission = self.source.mission()
        nid = previous['notification_id'] if previous else notices.notification_id(mission.name, crew_id, measure, created_at)
        return notices.build(notification_id=nid, revision=previous['revision'] if previous else 1, source_event_id=event,
                             mission=mission, mission_id=mission.name, crew_id=crew_id,
                             crew_ids=[c.id for c in self.source.crew()], contexts=contexts, day=now, priority=priority,
                             title=title, message=message, created_at=created_at, state=state, synthetic=synthetic,
                             keep_deliveries=previous['deliveries'] if previous and state != 'active' else None)

    def update_notices(self, crew_id, results, alerts, now):
        """Publish the notices for one crew member after processing their readings: a new notice for a measure
        that starts meeting the alert rule, a new revision when what it says changes, and a resolved revision when
        the measure no longer meets it. The HealthService publishes them; the Notification Center sends them."""
        contexts = crew_contexts(self.source)
        active = {measure_of(n): n for n in self.notices.latest(crew_id).values()
                  if n['state'] == 'active' and not measure_of(n).startswith('fixture-')}
        by_measure = {r.measure: r for r in results}
        stamp = self.source.mission().timestamp(now)     # revision 1 is dated by its test, later ones by the change
        for measure, alert in alerts.items():
            event = f"readings:{crew_id}:{measure}:{by_measure[measure].last_reading_at}"
            label = self.reference.measure(measure)['label']
            previous = active.get(measure)
            notice = self._notice(previous=previous, crew_id=crew_id, measure=measure,
                                  priority=PRIORITY.get(alert.severity, 'warning'),
                                  title=f'{label}: loss beyond expected', message=alert.message,
                                  created_at=stamp if previous else alert.created_at, event=event,
                                  contexts=contexts, now=now, synthetic=alert.synthetic)
            notices.update(self.queue, self.notices, previous, notice)
        for measure, previous in active.items():
            if measure in alerts or measure not in by_measure:
                continue
            res = by_measure[measure]
            notice = self._notice(previous=previous, crew_id=crew_id, measure=measure, priority=previous['priority'],
                                  title=previous['title'], message=previous['message'], created_at=stamp,
                                  event=f"readings:{crew_id}:{measure}:{res.last_reading_at}", contexts=contexts,
                                  now=now, synthetic=previous['synthetic'], state='resolved')
            notices.update(self.queue, self.notices, previous, notice)

    def refresh_notices(self):
        """Route the active notices again with the crew's context now: a new revision if that changes who gets
        them or what they are told (the subject is back from a spacewalk, for instance), otherwise the same
        revision again, which the queue drops. Fixtures keep their own made-up context and are left alone."""
        mission, now = self.source.mission(), self.source.current_day()
        contexts = crew_contexts(self.source)
        for crew in self.source.crew():
            for previous in self.notices.latest(crew.id).values():
                if previous['state'] != 'active' or measure_of(previous).startswith('fixture-'):
                    continue
                stamp = mission.timestamp(now)
                notice = self._notice(previous=previous, crew_id=crew.id, measure=measure_of(previous),
                                      priority=previous['priority'], title=previous['title'],
                                      message=previous['message'], created_at=stamp,
                                      event=f'context:{crew.id}:{stamp}', contexts=contexts, now=now,
                                      synthetic=previous['synthetic'])
                notices.update(self.queue, self.notices, previous, notice)

    def process_readings(self, message):
        crew = next(c for c in self.source.crew() if c.id == message['crew_id'])
        mission = self.source.mission()
        now = self.source.current_day()
        day = min(now, mission.day_of(message['end'])) if message.get('end') else now
        readings = self.source.readings(crew.id, day)
        results = compute_results(self.reference, mission, crew, readings, day)
        self.source.save_results(results)
        alerts = check(self.reference, mission, results)
        previous = self.findings.latest(crew.id)
        published = findings.changes(self.reference, mission, results, alerts, previous)
        findings.publish(self.queue, self.findings, crew.id, published, previous)
        self.update_notices(crew.id, results, alerts, now)

    def on_readings(self, message):
        """data.readings_stored: strength, VO2peak and bone go through the measure processing; the daily vitals of
        the watch and wearable through the personal-band check. The watch's 15-minute heart rate alone changes
        neither, so it is skipped (it arrives every few seconds at demo speed)."""
        measures = set(message.get('measures') or [])
        if not measures or measures & set(PROCESSED):
            self.process_readings(message)
        if measures & set(vitals.MEASURES):
            self.process_vitals(message['crew_id'])

    def process_vitals(self, crew_id):
        """The watch's findings for the Planner (docs/wearable.md, section 3): a suspected finding when a vital
        enters a deviation, cleared when it is back in its band."""
        mission, now = self.source.mission(), self.source.current_day()
        daily, *_ = vitals_inputs(self.source, mission, crew_id, now, curves=False)
        assessed = [vitals.assess(mission, m, daily.get(m, [])) for m in vitals.MEASURES]
        previous = self.findings.latest(crew_id)
        published = vitals.findings(crew_id, assessed, previous)
        for f in published:
            self.queue.publish(vitals.TOPIC, f, dedupe=vitals.dedupe(f))
        if published:
            self.findings.save(crew_id, dict(previous) | {f['measure']: f for f in published})

    def consume(self, consumer, channel, handler):
        item = self.queue.next(consumer, channel)
        if not item:
            return False
        message_id, topic, body = item
        handler(message_id, topic, body)
        self.queue.ack(consumer, message_id)
        return True

    def step(self):
        self.consume('health', 'events', lambda _, topic, body: self.on_readings(body) if topic == 'data.readings_stored' else None)
        # Stand-in for the Notification Center, which is what sends the notices: here it only records a delivery.
        self.consume('notifications', notices.CHANNEL, self.deliver)

    def deliver(self, message_id, topic, body):
        if topic == notices.TOPIC:
            for d in body['deliveries']:
                self.queue.deliver(message_id, f"{d['channel']}:{d['recipient_id']}",
                                   {k: body[k] for k in ('notification_id', 'revision', 'state', 'priority', 'crew_id')}
                                   | {'channel': d['channel'], 'recipient_id': d['recipient_id'], 'content': d['content']})
        else:
            for recipient in body.get('notify', []):
                self.queue.deliver(message_id, recipient, body)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-url', default='http://127.0.0.1:8000')
    parser.add_argument('--queue', default=os.environ.get('NASA_QUEUE'), help='SQLite queue file (default: $NASA_QUEUE)')
    args = parser.parse_args()
    if not args.queue:
        parser.error('no queue: pass --queue PATH or set NASA_QUEUE')
    logging.basicConfig(level=logging.INFO)
    worker = DemoWorker(DataServiceSource(args.data_url), Queue(args.queue))
    last_refresh = 0.0
    while True:
        try:
            worker.step()
            if time.monotonic() - last_refresh >= 5:
                worker.refresh_notices()
                last_refresh = time.monotonic()
        except Exception:
            log.exception('Demo worker failed; retrying')
        time.sleep(0.25)


if __name__ == '__main__':
    main()
