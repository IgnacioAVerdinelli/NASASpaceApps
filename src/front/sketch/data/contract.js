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
