"""Light-time from Horizons; the demo approximates round trip as twice one-way."""
import csv
import io
import json
import math
import threading
from datetime import datetime, timezone
from urllib.parse import urlencode
from urllib.request import urlopen

class HorizonsLatency:
    def __init__(self, fetch=None, local_seconds=None):
        self.fetch = fetch or self._fetch
        self.local = local_seconds or {'wearable': .05, 'room': .1, 'ship_center': .1, 'radio': .1}
        self.cache = {}
        self.lock = threading.Lock()
        self.request_lock = threading.Lock()

    @staticmethod
    def _fetch(params):
        url = 'https://ssd.jpl.nasa.gov/api/horizons.api?' + urlencode(params)
        with urlopen(url, timeout=15) as response:
            return json.load(response)

    def __call__(self, channel, location):
        if channel != 'earth':
            delay = self.local[channel]
            return {'one_way_seconds': delay, 'confirmation_seconds': delay,
                    'source': 'local-demo', 'scale': 1}
        if not isinstance(location, dict) or location.get('mode') != 'body':
            raise ValueError('Earth pending: mission location unavailable')
        body = str(location.get('body_id', ''))
        if not body.isdigit():
            raise ValueError('invalid Horizons body ID')
        epoch = datetime.fromisoformat(location['epoch'].replace('Z', '+00:00'))
        if epoch.tzinfo is None:
            raise ValueError('mission epoch requires timezone')
        stamp = epoch.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        key = (body, stamp)
        with self.lock:
            seconds = self.cache.get(key)
        if seconds is None:
            if body == '399':
                seconds = 0.0  # Earth-center proxy; not an ISS orbital propagation model.
            else:
                with self.request_lock:
                    data = self.fetch({'format': 'json', 'COMMAND': f"'{body}'", 'CENTER': "'500@399'",
                    'EPHEM_TYPE': "'VECTORS'", 'TLIST': f"'{stamp}'", 'TLIST_TYPE': "'CAL'",
                    'TIME_TYPE': "'UT'", 'OUT_UNITS': "'KM-S'", 'VEC_TABLE': "'3'",
                    'CSV_FORMAT': "'YES'", 'OBJ_DATA': "'NO'"})
                if data.get('error'):
                    raise ValueError(f"Horizons: {data['error']}")
                result = data.get('result', '')
                if '$$SOE' not in result or '$$EOE' not in result:
                    raise ValueError('Horizons response has no ephemeris')
                row = next(csv.reader(io.StringIO(result.split('$$SOE')[1].split('$$EOE')[0].strip())))
                seconds = float(row[8])  # JD, calendar, XYZ, VXYZ, LT (KM-S).
            if not math.isfinite(seconds) or seconds < 0:
                raise ValueError('invalid light time')
            with self.lock:
                if len(self.cache) >= 512:
                    self.cache.pop(next(iter(self.cache)))
                self.cache[key] = seconds
        return {'one_way_seconds': seconds / 600, 'confirmation_seconds': seconds * 2 / 600,
                'real_one_way_seconds': seconds, 'source': 'earth-center-proxy' if body == '399' else 'NASA/JPL Horizons',
                'scale': 600, 'body_id': body, 'epoch': location['epoch']}
