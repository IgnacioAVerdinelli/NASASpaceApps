import { muscles } from '../../body-3d/anatomy.js';

const keys = new Set(muscles.map(item => item.key));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.length <= 1000;
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?(?:Z|[+-]\d\d:\d\d)$/.test(value) && Number.isFinite(Date.parse(value));
const optionalNumber = value => value === null || (typeof value === 'number' && Number.isFinite(value));
const muscleKeys = value => Array.isArray(value) && value.every(key => keys.has(key));

// Validate the response before replacing a previously valid dashboard.
export function validateDashboard(data) {
  const fail = message => { throw new Error(`Invalid dashboard: ${message}`); };
  if (!object(data) || data.version !== 1 || !timestamp(data.updatedAt) || typeof data.simulated !== 'boolean') fail('version or metadata');
  const b = data.body;
  if (!object(b) || !['male', 'female'].includes(b.body) || !['surface', 'muscles', 'skeleton'].includes(b.layer) || !(b.selected === null || keys.has(b.selected)) || !object(b.scores)) fail('body');
  if (Object.entries(b.scores).some(([key, value]) => !keys.has(key) || value !== null && (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100))) fail('scores');
  if (!(b.viewRequest === null || object(b.viewRequest) && ['front', 'back'].includes(b.viewRequest.direction) && Number.isSafeInteger(b.viewRequest.request) && b.viewRequest.request >= 0)) fail('viewRequest');
  const summary = data.summary;
  if (!object(summary) || !text(summary.title) || !text(summary.description) || !text(summary.notice) || !Array.isArray(summary.items)) fail('summary');
  if (summary.items.length > 100 || summary.items.some(item => !object(item) || !text(item.id) || !item.id || !muscleKeys(item.muscleKeys) || !text(item.title) || !text(item.description) || !optionalNumber(item.changePercent))) fail('summary items');
  if (!Array.isArray(data.charts) || data.charts.length > 100 || data.charts.some(chart => !object(chart) || !text(chart.id) || !chart.id || !muscleKeys(chart.muscleKeys) || !text(chart.title) || !text(chart.description) || !text(chart.unit) || !optionalNumber(chart.reference) || !(chart.insight === null || text(chart.insight)) || !Array.isArray(chart.points) || chart.points.length > 10000 || chart.points.some(point => !object(point) || !timestamp(point.at) || !optionalNumber(point.value)))) fail('charts');
  if (new Set(summary.items.map(item => item.id)).size !== summary.items.length || new Set(data.charts.map(chart => chart.id)).size !== data.charts.length) fail('duplicate ids');
  return data;
}

// Flight-measurement page (vuelo.html): GET /api/v1/analyses, documented in docs/frontend-backend.md.
const number = value => typeof value === 'number' && Number.isFinite(value);
const nonEmpty = value => text(value) && value.length > 0;
const optionalBoolean = value => value === null || typeof value === 'boolean';
const level = value => value === null || (Number.isInteger(value) && value >= 1 && value <= 4);
const alertOf = value => value === null || (object(value) && ['warning', 'critical'].includes(value.severity) && nonEmpty(value.rule) && nonEmpty(value.message));
const upcomingList = value => Array.isArray(value) && value.length <= 100 && value.every(item => object(item) && number(item.day) && nonEmpty(item.label) && ['routine', 'retest'].includes(item.reason));
const testPoint = value => object(value) && optionalNumber(value.value) && optionalNumber(value.changePct) && level(value.level) && optionalBoolean(value.withinNoise) && optionalBoolean(value.belowMinimum) && nonEmpty(value.quality);
const evaluation = value => object(value) && nonEmpty(value.id) && number(value.day) && nonEmpty(value.label) && ['pre', 'flight', 'post'].includes(value.phase);

// Validate the response before replacing previously valid analyses.
export function validateAnalyses(data) {
  const fail = message => { throw new Error(`Invalid analyses: ${message}`); };
  if (!object(data) || data.version !== 1 || !timestamp(data.updatedAt) || typeof data.simulated !== 'boolean' || !text(data.notice)) fail('version or metadata');
  if (!object(data.crew) || !nonEmpty(data.crew.id) || !['male', 'female'].includes(data.crew.body)) fail('crew');
  const mission = data.mission;
  if (!object(mission) || !text(mission.name) || !number(mission.today) || !nonEmpty(mission.todayLabel) || !number(mission.landing)) fail('mission');
  if (!Array.isArray(data.levels) || data.levels.length !== 4 || data.levels.some((item, i) => !object(item) || item.level !== i + 1 || !nonEmpty(item.label) || !nonEmpty(item.range))) fail('levels');
  const strength = data.strength;
  if (!object(strength) || !Array.isArray(strength.evaluations) || strength.evaluations.length > 100 || !strength.evaluations.every(evaluation) || !Array.isArray(strength.groups) || strength.groups.length > 50 || !upcomingList(strength.upcoming)) fail('strength');
  if (new Set(strength.evaluations.map(item => item.id)).size !== strength.evaluations.length) fail('duplicate evaluations');
  if (strength.groups.some(group => !object(group) || !nonEmpty(group.key) || !nonEmpty(group.measure) || !nonEmpty(group.name) || !nonEmpty(group.test) || !text(group.region) || !muscleKeys(group.muscleKeys) || !group.muscleKeys.length || !text(group.unit) || !optionalNumber(group.baseline) || !Number.isInteger(group.referenceTests) || group.referenceTests < 0 || !number(group.noiseBandPct) || !alertOf(group.alert) || !Array.isArray(group.points) || group.points.length !== strength.evaluations.length || group.points.some((point, i) => !testPoint(point) || point.evaluation !== strength.evaluations[i].id))) fail('strength groups');
  if (new Set(strength.groups.map(group => group.key)).size !== strength.groups.length) fail('duplicate groups');
  const aerobic = data.aerobic;
  if (!object(aerobic) || !nonEmpty(aerobic.measure) || !nonEmpty(aerobic.name) || !nonEmpty(aerobic.test) || !text(aerobic.unit) || !optionalNumber(aerobic.baseline) || !Number.isInteger(aerobic.referenceTests) || aerobic.referenceTests < 0 || !number(aerobic.noiseBandPct) || !optionalNumber(aerobic.minimum) || !number(aerobic.standardLossPct) || !alertOf(aerobic.alert) || !upcomingList(aerobic.upcoming)) fail('aerobic');
  if (!Array.isArray(aerobic.evaluations) || aerobic.evaluations.length > 100 || aerobic.evaluations.some(item => !evaluation(item) || !testPoint(item) || !(item.test === null || object(item.test)))) fail('aerobic evaluations');
  if (new Set(aerobic.evaluations.map(item => item.id)).size !== aerobic.evaluations.length) fail('duplicate evaluations');
  return data;
}
