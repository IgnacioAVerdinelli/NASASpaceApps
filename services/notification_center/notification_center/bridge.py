"""Consume gravsim's shared notifications channel; ack only after durable local ingress."""
import json
import logging
import threading
from datetime import datetime
from .core import utc_now

class QueueBridge:
    def __init__(self, center, queue, source=None, consumer='notification-center-v1'):
        self.center, self.queue, self.source, self.consumer = center, queue, source, consumer
        self.stop = threading.Event()
        self.thread = None
        self.reconciler = None
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
        self.validate_plan(topic, body)
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
        states = self.plan_states(body['crew_id'])
        state = states.get(item['id'], item.get('status'))
        if missed:
            self.retire_item(body['crew_id'], item['id'], 'missed', reminders_only=True)
        if state in {'done', 'cancelled'} or (state == 'missed' and not missed):
            message['state'] = 'cancelled' if state == 'cancelled' else 'resolved'
        return message

    @staticmethod
    def validate_plan(topic, body):
        if not isinstance(body, dict):
            raise ValueError('Planner payload must be an object')
        for key in ('crew_id', 'type', 'created_at'):
            if not isinstance(body.get(key), str) or not body[key].strip():
                raise ValueError(f'invalid Planner {key}')
        if body['type'] != topic.replace('.', '_'):
            raise ValueError('Planner topic/type mismatch')
        try:
            if datetime.fromisoformat(body['created_at'].replace('Z', '+00:00')).tzinfo is None:
                raise ValueError()
        except ValueError:
            raise ValueError('Planner created_at requires ISO timestamp with timezone') from None
        item = body.get('item')
        if not isinstance(item, dict):
            raise ValueError('Planner item must be an object')
        for key in ('id', 'title', 'status'):
            if not isinstance(item.get(key), str) or not item[key].strip():
                raise ValueError(f'invalid Planner item.{key}')
        if item['status'] not in {'booked', 'done', 'missed', 'cancelled'}:
            raise ValueError('invalid Planner item status')
        if not isinstance(item.get('window'), dict):
            raise ValueError('Planner item.window must be an object')
        if not isinstance(body.get('notify', []), list) or any(not isinstance(who, str) for who in body.get('notify', [])):
            raise ValueError('Planner notify must be a list of IDs')
        if body.get('synthetic', True) is not True:
            raise ValueError('demo requires synthetic=true')

    def plan_states(self, crew_id):
        records = self.source._request('GET', '/api/v1/results', {'crew': crew_id, 'kind': 'plan'})
        if not isinstance(records, list):
            raise RuntimeError('invalid DataService plan response; retrying')
        mine = [record for record in records if record.get('model_version') == 'planner-1']
        if not mine:
            return {}
        return {item['id']: item['status'] for item in mine[-1]['payload']['items']}

    def retire_item(self, crew_id, item_id, status, reminders_only=False):
        # Serialize lifecycle revisions with publishing, including the reconciliation thread.
        with self.center.lock:
            self._retire_item(crew_id, item_id, status, reminders_only)

    def _retire_item(self, crew_id, item_id, status, reminders_only=False):
        with self.center.lock:
            rows = self.center.db.execute('SELECT payload FROM messages m WHERE revision=(SELECT MAX(revision) FROM messages WHERE id=m.id)').fetchall()
        for row in rows:
            message = json.loads(row['payload'])
            if (message.get('source') != 'planner-bridge' or message.get('crew_id') != crew_id
                    or message.get('mission_id') != self.source.mission().name
                    or message.get('plan_item_id') != item_id or message.get('state', 'active') != 'active'):
                continue
            if (reminders_only or status == 'missed') and message.get('kind') != 'plan_reminder':
                continue
            message.update(revision=message['revision'] + 1,
                           state='cancelled' if status == 'cancelled' else 'resolved', requires_ack=False)
            for delivery in message['deliveries']:
                delivery['content'] = f"Actividad de protocolo {status}: {item_id}."
            self.center.publish(message)

    def reconcile(self):
        if self.source is None:
            return
        with self.center.lock:
            rows = self.center.db.execute('SELECT payload FROM messages m WHERE revision=(SELECT MAX(revision) FROM messages WHERE id=m.id)').fetchall()
        targets = set()
        for row in rows:
            message = json.loads(row['payload'])
            if message.get('source') == 'planner-bridge' and message.get('state', 'active') == 'active':
                targets.add((message['crew_id'], message['plan_item_id']))
        for crew_id in {crew for crew, _ in targets}:
            states = self.plan_states(crew_id)
            for crew, item_id in targets:
                if crew == crew_id and states.get(item_id) in {'done', 'cancelled', 'missed'}:
                    self.retire_item(crew_id, item_id, states[item_id])

    def study(self, body):
        if not isinstance(body, dict) or not isinstance(body.get('study'), dict):
            raise ValueError('invalid study.due payload')
        for value in (body.get('crew_id'), body.get('timestamp'), body['study'].get('id'), body['study'].get('study')):
            if not isinstance(value, str) or not value.strip():
                raise ValueError('study.due fields must be nonempty strings')
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
        def reconcile_loop():
            while not self.stop.is_set():
                try:
                    self.reconcile()
                except Exception:
                    logging.exception('Plan reconciliation failed; keeping notifications for retry')
                self.stop.wait(2)
        self.reconciler = threading.Thread(target=reconcile_loop, daemon=True)
        self.reconciler.start()

    def close(self):
        self.stop.set()
        if self.thread:
            self.thread.join(timeout=35)
        if self.reconciler:
            self.reconciler.join(timeout=35)
