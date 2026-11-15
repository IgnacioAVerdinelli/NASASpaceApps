"""The prepared demo cases must be visible through the real health calculations."""
import unittest

from gravsim.demo_cases import demo_mission
from healthservice.service import HealthService
from healthservice.sources import GravsimSource


class DemoCasesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mission = demo_mission()
        cls.service = HealthService(GravsimSource(mission=cls.mission, seed=7, day=130))

    def test_five_distinct_cases(self):
        self.assertEqual([c.id for c in self.mission.crew], [f"CM-{i}" for i in range(1, 6)])
        normal = self.service.vitals("CM-1")
        self.assertTrue(all(v["status"] == "in_range" for v in normal["vitals"]))
        recent = self.service.vitals("CM-2")
        self.assertEqual(next(v for v in recent["vitals"] if v["measure"] == "sleep_quality")["status"], "out")
        persistent = self.service.vitals("CM-3")
        self.assertEqual(next(v for v in persistent["vitals"] if v["measure"] == "resting_hr")["status"], "deviation")
        strength = self.service.analyses("CM-4")["strength"]["groups"]
        self.assertTrue(any(g["alert"] for g in strength))
        aerobic = self.service.analyses("CM-5")["aerobic"]
        self.assertEqual(aerobic["alert"]["rule"], "nasa_standard")
        self.assertLess(aerobic["evaluations"][-1]["changePct"], -20)

    def test_profiles_are_reproducible(self):
        other = demo_mission()
        for first, second in zip(self.mission.crew, other.crew):
            self.assertEqual(first.true_value("vo2peak", 74), second.true_value("vo2peak", 74))


if __name__ == "__main__":
    unittest.main()
