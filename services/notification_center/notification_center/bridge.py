"""Consume gravsim's shared notifications channel; ack only after durable local ingress."""
import json
import logging
import threading
from .core import utc_now

class QueueBridge:
    def __init__(self, center, queue, source=None, consumer='notification-center-v1'):
        self.center, self.queue, self.source, self.consumer = center, queue, source, consumer
        self.stop = threading.Event()
        self.thread = None
        with center.lock, center.db:
            center.db.execute('CREATE TABLE IF NOT EXISTS rejected_messages (id INTEGER PRIMARY KEY, topic TEXT, body TEXT, error TEXT, at TEXT)')

    def step(self):
        item = self.queue.next(self.consumer, 'notifications')
        if item is None:
            return False
        identifier, topic, body = item
        try:
            if topic == 'health.notice':
                message = body
            elif topic == 'study.due':
                message = self.study(body)
            elif topic in {'plan.reminder', 'plan.missed'}:
                message = self.plan_notice(topic, body)
            else:
                raise ValueError(f'unsupported topic: {topic}')
            self.center.publish(message)
        except ValueError as exc:
            with self.center.lock, self.center.db:
                self.center.db.execute('INSERT OR REPLACE INTO rejected_messages VALUES(?,?,?,?,?)',
                    (identifier, topic, json.dumps(body), str(exc), utc_now()))
        self.queue.ack(self.consumer, identifier)
        return True

    def plan_notice(self, topic, body):
        if self.source is None:
            raise RuntimeError('Planner reminders require --data-url')
        from healthservice import notices
        mission, day = self.source.mission(), self.source.current_day()
        crew = [c.id for c in self.source.crew()]
        contexts = {c: self.source._request('GET', '/api/v1/context/current', {'crew': c}) for c in crew}
        item = body['item']
        if body['crew_id'] not in crew:
            raise ValueError('unknown planner crew')
        missed = topic == 'plan.missed'
        message = notices.build(notification_id=f"planner:{mission.name}:{body['crew_id']}:{item['id']}:{topic}",
            revision=1, source_event_id=f"{topic}:{body['crew_id']}:{item['id']}", mission=mission,
            mission_id=mission.name, crew_id=body['crew_id'], crew_ids=crew, contexts=contexts, day=day,
            priority='info', title='Actividad vencida' if missed else 'Actividad de protocolo',
            message=f"{'Venció la ventana para' if missed else 'Corresponde'} {item['title']}. Ventana: {item['window']}",
            created_at=body['created_at'], synthetic=body.get('synthetic', True))
        if 'ship_center' in body.get('notify', []):
            message['deliveries'].append({'channel':'ship_center', 'recipient_id':notices.SHIP_CENTER,
                'content':f"{body['crew_id']}: actividad de protocolo vencida: {item['title']}.", 'audience':'operational'})
        message.update(source='planner-bridge', kind=body['type'], plan_item_id=item['id'])
        return message

    def study(self, body):
        # Legacy scheduler payload lacks routing and mission geometry: resolve using producer's shared policy.
        if self.source is None:
            raise RuntimeError('study.due requires --data-url; source message remains unacknowledged')
        from healthservice import notices
        mission, day = self.source.mission(), self.source.current_day()
        crew = [c.id for c in self.source.crew()]
        contexts = {c: self.source._request('GET', '/api/v1/context/current', {'crew': c}) for c in crew}
        study = body['study']
        result = notices.build(notification_id=f"scheduler:{mission.name}:{body['crew_id']}:{study['id']}",
            revision=1, source_event_id=f"study:{body['crew_id']}:{study['id']}", mission=mission,
            mission_id=mission.name, crew_id=body['crew_id'], crew_ids=crew, contexts=contexts, day=day,
            priority='info', title='Actividad de protocolo',
            message=f"Corresponde {study['study']} · fecha programada {body['timestamp']}",
            created_at=body['timestamp'], synthetic=True)
        result.update(source='scheduler-bridge', kind='protocol_reminder', scheduled_for=body['timestamp'])
        return result

    def start(self):
        def run():
            while not self.stop.is_set():
                try:
                    if self.step():
                        continue
                except Exception:
                    logging.exception('Notification bridge failed; retaining source cursor')
                self.stop.wait(.5)
        self.thread = threading.Thread(target=run, daemon=True)
        self.thread.start()

    def close(self):
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=35)
