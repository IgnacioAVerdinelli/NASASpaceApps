import copy
import json
import tempfile
import threading
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from notification_center.core import NotificationCenter, validate
from notification_center.fixtures import make_scenario
from notification_center.server import make_server


def eventually(check):
    deadline = time.monotonic() + 3
    while time.monotonic() < deadline:
        result = check()
        if result:
            return result
        time.sleep(.01)
    raise AssertionError("condition did not become true")


class CenterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / "queue.sqlite3"
        self.center = NotificationCenter(self.path, retry_seconds=.01)
        self.addCleanup(lambda: self.center.close())

    def send(self, scenario="mild", crew="CM-1"):
        message = make_scenario(scenario, crew)
        self.center.publish(message)
        self.center.tick()
        eventually(lambda: self.center.inbox(crew))
        return message

    def test_mild_is_personal_no_ack_and_earth_in_same_cycle(self):
        self.send()
        eventually(lambda: all(row["status"] == "delivered" for row in self.center.deliveries()))
        rows = self.center.deliveries()
        self.assertEqual({r["channel"] for r in rows}, {"earth", "wearable"})
        self.assertEqual(len({r["dispatch_cycle"] for r in rows}), 1)
        inbox = self.center.inbox("CM-1")
        self.assertFalse(inbox[0]["requires_ack"])
        self.assertNotIn("deliveries", inbox[0])
        self.assertEqual(self.center.inbox("CM-2"), [])
        with self.assertRaisesRegex(ValueError, "does not require"):
            self.center.acknowledge(inbox[0]["delivery_id"], "CM-1")

    def test_all_output_receivers_are_durable_and_addressed(self):
        self.send("eva")
        eventually(lambda: all(row["status"] == "delivered" for row in self.center.deliveries()))
        for channel, recipient in (("wearable", "CM-1"), ("earth", "mission-control"),
                                   ("room", "operations"), ("ship_center", "onboard"), ("radio", "eva-CM-1")):
            output = self.center.outputs(channel, recipient)
            self.assertEqual(len(output), 1)
            self.assertEqual(output[0]["recipient_id"], recipient)
            self.assertNotIn("deliveries", output[0])
            self.assertEqual(self.center.outputs(channel, "someone-else"), [])
        before = self.center.outputs("radio", "eva-CM-1")
        self.center.close()
        self.center = NotificationCenter(self.path)
        self.assertEqual(self.center.outputs("radio", "eva-CM-1"), before)

    def test_replace_one_transport_without_changing_other_outputs(self):
        received = []
        def send(envelope):
            received.append(envelope)
            if len(received) == 1:
                raise ConnectionError("temporary gateway failure")
        self.center.transports["earth"] = send
        self.send()
        eventually(lambda: any(r["status"] == "waiting_link" for r in self.center.deliveries()))
        self.assertTrue(self.center.outputs("wearable", "CM-1"))
        self.center.set_channel("earth", True)
        self.center.tick()
        eventually(lambda: len(received) == 2)
        self.assertEqual(received[0]["idempotency_key"], received[1]["idempotency_key"])
        self.assertNotIn("deliveries", received[0])

    def test_cancel_retracts_room_projection_but_keeps_earth_history(self):
        message = self.send("critical")
        eventually(lambda: self.center.outputs("room", "operations"))
        message.update(revision=2, state="cancelled")
        self.center.publish(message)
        self.center.tick()
        self.assertEqual(self.center.outputs("room", "operations"), [])
        eventually(lambda: len(self.center.outputs("earth", "mission-control")) == 2)

    def test_critical_fanout_precedes_any_ack(self):
        self.send("critical")
        eventually(lambda: self.center.inbox("CM-2") and self.center.inbox("CM-3"))
        eventually(lambda: all(row["status"] == "delivered" for row in self.center.deliveries()))
        rows = self.center.deliveries()
        self.assertTrue({"earth", "room", "ship_center", "wearable"}.issubset({r["channel"] for r in rows}))
        self.assertTrue(all(r["acknowledged_at"] is None for r in rows))
        own = self.center.inbox("CM-1")[0]
        with self.assertRaises(ValueError):
            self.center.acknowledge(own["delivery_id"], "CM-2")
        self.center.acknowledge(own["delivery_id"], "CM-1")
        self.center.acknowledge(own["delivery_id"], "CM-1")
        self.assertIsNotNone(self.center.inbox("CM-1")[0]["acknowledged_at"])
        self.assertIsNone(self.center.inbox("CM-2")[0]["acknowledged_at"])

    def test_eva_requires_radio_and_shared_outputs(self):
        message = self.send("eva")
        self.assertIn("radio", {r["channel"] for r in message["deliveries"]})
        message["deliveries"] = [r for r in message["deliveries"] if r["channel"] != "radio"]
        with self.assertRaisesRegex(ValueError, "radio"):
            validate(message)

    def test_slow_earth_never_occupies_onboard_executor(self):
        gate = threading.Event()
        entered = threading.Event()
        def adapter(job):
            if job["channel"] == "earth":
                entered.set()
                gate.wait(3)
        self.center.adapter = adapter
        try:
            for _ in range(5):
                self.center.publish(make_scenario("mild", "CM-1"))
            self.center.tick()
            self.assertTrue(entered.wait(1))
            eventually(lambda: len(self.center.inbox("CM-1")) == 5)
            self.assertTrue(any(r["channel"] == "earth" and r["status"] == "dispatching" for r in self.center.deliveries()))
        finally:
            gate.set()

    def test_disconnected_earth_survives_restart_and_recovers(self):
        self.center.set_channel("earth", False)
        self.send()
        eventually(lambda: any(r["status"] == "waiting_link" for r in self.center.deliveries()))
        self.center.close()
        self.center = NotificationCenter(self.path, retry_seconds=.01)
        self.assertEqual(len(self.center.inbox("CM-1")), 1)
        self.center.set_channel("earth", True)
        self.center.tick()
        eventually(lambda: all(r["status"] == "delivered" for r in self.center.deliveries()))
        self.assertEqual(len(self.center.deliveries()), 2)

    def test_local_failure_does_not_block_earth(self):
        self.center.set_channel("wearable", False)
        self.center.publish(make_scenario("mild", "CM-1"))
        self.center.tick()
        eventually(lambda: any(r["channel"] == "earth" and r["status"] == "delivered" for r in self.center.deliveries()))
        eventually(lambda: any(r["channel"] == "wearable" and r["status"] == "retrying" for r in self.center.deliveries()))
        self.assertEqual(self.center.inbox("CM-1"), [])
        self.center.set_channel("wearable", True)
        self.center.tick()
        eventually(lambda: self.center.inbox("CM-1"))

    def test_duplicate_conflict_revision_and_cancel(self):
        message = self.send()
        self.assertEqual(self.center.publish(message)["status"], "duplicate")
        conflict = copy.deepcopy(message)
        conflict["title"] = "changed"
        with self.assertRaisesRegex(ValueError, "different content"):
            self.center.publish(conflict)
        updated = copy.deepcopy(message)
        updated.update(revision=2, state="cancelled")
        self.center.publish(updated)
        self.center.tick()
        self.assertEqual(self.center.inbox("CM-1"), [])
        eventually(lambda: len([r for r in self.center.deliveries() if r["channel"] == "earth"]) == 2)
        self.assertEqual(len([r for r in self.center.deliveries() if r["channel"] == "wearable"]), 2)

    def test_reroute_before_consumption_hides_old_local_routes(self):
        old = make_scenario("mild", "CM-1")
        new = copy.deepcopy(old)
        new.update(revision=2, crew_id="CM-2")
        new["deliveries"][0]["recipient_id"] = "CM-2"
        self.center.publish(old)
        self.center.publish(new)
        self.center.tick()
        eventually(lambda: self.center.inbox("CM-2"))
        self.assertEqual(self.center.inbox("CM-1"), [])
        self.assertEqual(len(self.center.deliveries()), 3)  # Earth retains both revisions.

    def test_queued_message_survives_restart(self):
        self.center.publish(make_scenario("reminder", "CM-1"))
        self.center.close()
        self.center = NotificationCenter(self.path)
        self.center.tick()
        eventually(lambda: self.center.inbox("CM-1"))
        self.assertEqual(self.center.inbox("CM-1")[0]["kind"], "protocol_reminder")

    def test_rejects_missing_earth_invalid_priority_and_unsafe_critical(self):
        for key, value in (("priority", []), ("synthetic", False), ("created_at", "2026-11-14")):
            message = make_scenario("mild", "CM-1")
            message[key] = value
            with self.subTest(key=key), self.assertRaises(ValueError):
                validate(message)
        message = make_scenario("critical", "CM-1")
        message["deliveries"] = message["deliveries"][:2]
        with self.assertRaises(ValueError):
            validate(message)
        message = make_scenario("mild", "CM-1")
        message["deliveries"] = message["deliveries"][:1]
        with self.assertRaisesRegex(ValueError, "Earth"):
            validate(message)


class HTTPTests(unittest.TestCase):
    def test_publish_poll_ack_and_rejected_input(self):
        with tempfile.TemporaryDirectory() as temp:
            center = NotificationCenter(Path(temp) / "test.db")
            server = make_server(center, 0)
            worker = threading.Thread(target=server.serve_forever, daemon=True)
            center.start()
            worker.start()
            base = f"http://127.0.0.1:{server.server_port}/api/v1"
            def call(path, body=None):
                request = Request(base + path, data=json.dumps(body).encode() if body is not None else None,
                                  headers={"Content-Type": "application/json"})
                with urlopen(request, timeout=2) as response:
                    return response.status, json.load(response)
            try:
                self.assertEqual(call("/demo/scenarios", {"scenario": "critical", "crew_id": "CM-1"})[0], 202)
                inbox = eventually(lambda: call("/notifications?crew=CM-1")[1]["notifications"])
                own = inbox[0]["delivery_id"]
                self.assertEqual(call(f"/deliveries/{own}/ack", {"crew_id": "CM-1"})[0], 200)
                self.assertIsNotNone(call("/notifications?crew=CM-1")[1]["notifications"][0]["acknowledged_at"])
                self.assertGreater(len(call("/deliveries")[1]["deliveries"]), 1)
                with self.assertRaises(HTTPError) as caught:
                    call("/messages", {"invalid": True})
                self.assertEqual(caught.exception.code, 400)
                caught.exception.close()
            finally:
                server.shutdown()
                worker.join()
                server.server_close()
                center.close()


if __name__ == "__main__":
    unittest.main()
