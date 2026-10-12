import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import AIReport from '../components/AIReport';
import AIWorkspace, { workspaceFields, workspacePresets } from '../components/AIWorkspace';
import AgentsNewPage, { FEATURES } from '../pages/AgentsNewPage';
import AgentsPage from '../pages/AgentsPage';
import { agentPreset } from '../pages/agentPresets';
import LoginPage from '../pages/LoginPage';
import DatabasesPage from '../pages/DatabasesPage';
import QueriesPage from '../pages/QueriesPage';
import IndexesPage from '../pages/IndexesPage';
import BackupsPage from '../pages/BackupsPage';
import api from '../services/api';

global.IS_REACT_ACT_ENVIRONMENT = true;
function mount(element) {
  const host = document.createElement('div'); document.body.append(host);
  const root = createRoot(host);
  return { host, root, render: async () => { await act(async () => { root.render(element); }); }, cleanup: async () => { await act(async () => root.unmount()); host.remove(); } };
}

afterEach(() => { jest.restoreAllMocks(); delete global.fetch; });

test('every advanced agent preset fills its editable fields without inventing database IDs', () => {
  expect(FEATURES).toHaveLength(13);
  for (const feature of FEATURES) for (const variant of [0, 1]) {
    const next = agentPreset(feature, variant, { db_id: 987654 });
    for (const field of feature.fields) {
      if (field.name === 'db_id') { expect(next.db_id).toBe(987654); continue; }
      expect(next[field.name]).not.toBeUndefined();
      expect(next[field.name]).not.toBe('');
      if (feature.parseFields?.includes(field.name)) expect(() => JSON.parse(next[field.name])).not.toThrow();
    }
  }
});

test('advanced agent example button fills visible required and optional inputs without calling AI', async () => {
  global.fetch = jest.fn();
  const view = mount(<AgentsNewPage />); await view.render();
  await act(async () => view.host.querySelector('button').click());
  const example = [...view.host.querySelectorAll('button')].find((item) => item.textContent === 'Operations example');
  expect(example).toBeDefined();
  await act(async () => example.click());
  const inputs = view.host.querySelectorAll('textarea, input');
  expect(inputs).toHaveLength(2);
  for (const input of inputs) expect(input.value).not.toBe('');
  expect(global.fetch).not.toHaveBeenCalled();
  await view.cleanup();
});

test('basic agent tabs each have two fill-only examples', async () => {
  global.fetch = jest.fn();
  const view = mount(<AgentsPage />); await view.render();
  for (const tab of ['Query Optimizer', 'Index Advisor', 'Health Check']) {
    await act(async () => [...view.host.querySelectorAll('button')].find((button) => button.textContent.includes(tab)).click());
    const examples = ['Operations example', 'Review example'];
    for (const label of examples) {
      await act(async () => [...view.host.querySelectorAll('button')].find((button) => button.textContent === label).click());
      expect(view.host.querySelector('textarea').value).not.toBe('');
    }
  }
  expect(global.fetch).not.toHaveBeenCalled();
  await view.cleanup();
});

test('workspace presets fill required and optional fields with no generation', async () => {
  const feature = { id: 'fixture', title: 'Fixture', description: 'Fixture', samples: [] };
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ items: [] }) }));
  const view = mount(<AIWorkspace feature={feature} token="fixture-token" />); await view.render();
  const button = [...view.host.querySelectorAll('button')].find((item) => item.textContent === 'Scenario');
  await act(async () => button.click());
  for (const field of workspaceFields) expect(view.host.querySelector(`#fixture-${field.key}`).value).not.toBe('');
  expect(workspacePresets(feature)).toHaveLength(3);
  expect(global.fetch.mock.calls.every(([url]) => !url.endsWith('/run'))).toBe(true);
  await view.cleanup();
});

test('returned and saved structured JSON render labels, facts, lists, tables, false, zero and empty strings', async () => {
  const result = { result_json: { summary: { enabled: false, failures: 0, note: '' }, actions: [{ owner: 'DBA', priority: 1 }, { owner: 'SRE', priority: 2 }], observations: ['Check lag', 'Review backup'] } };
  const html = renderToStaticMarkup(<AIReport response={result} title="Fixture" />);
  for (const expected of ['Summary', 'Enabled', 'No', 'Failures', '0', 'Empty string', '<table', 'Observations', '<ul']) expect(html).toContain(expected);
  const feature = { id: 'fixture', title: 'Fixture', description: 'Fixture', samples: [] };
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ items: [{ id: 1, input: { goal: 'Review health' }, created_at: '2026-10-10T00:00:00Z', ...result }] }) }));
  const view = mount(<AIWorkspace feature={feature} token="fixture-token" />); await view.render();
  await act(async () => { await Promise.resolve(); });
  const row = view.host.querySelector('.ai-history-row'); expect(row).not.toBeNull();
  await act(async () => row.click());
  const dialog = document.body.querySelector('.ai-workspace-modal');
  expect(dialog.textContent).toContain('Empty string');
  expect(dialog.querySelector('table')).not.toBeNull();
  await view.cleanup();
});

test('demo login uses server endpoint and never posts browser credentials', async () => {
  global.fetch = jest.fn(async () => ({ ok: false, json: async () => ({ error: 'Demo login is disabled in this environment.' }) }));
  const view = mount(<LoginPage onLogin={jest.fn()} />); await view.render();
  await act(async () => view.host.querySelector('button[type="button"]').click());
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toBe('/api/auth/demo-login');
  expect(global.fetch.mock.calls[0][1].body).toBeUndefined();
  expect(view.host.querySelector('[role="alert"]').textContent).toContain('disabled');
  await view.cleanup();
});

test('successful demo response signs in without filling or submitting the password form', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ token: 'fixture-token', user: { role: 'observer' } }) }));
  const onLogin = jest.fn();
  const view = mount(<LoginPage onLogin={onLogin} />); await view.render();
  await act(async () => view.host.querySelector('button[type="button"]').click());
  expect(onLogin).toHaveBeenCalledTimes(1);
  expect(view.host.querySelector('input[type="password"]').value).toBe('');
  expect(global.fetch.mock.calls[0][0]).toBe('/api/auth/demo-login');
  localStorage.removeItem('token');
  await view.cleanup();
});

test('primary record views render all 18 seed-domain rows from paginated API payloads', async () => {
  const names = ['Production MySQL', 'Analytics PostgreSQL', 'User MongoDB', 'Cache Redis', 'Search Elasticsearch', 'Staging PostgreSQL', 'Logs TimescaleDB', 'Auth DynamoDB', 'Reports MySQL', 'Inventory PostgreSQL', 'Payment Cassandra', 'ML Features PostgreSQL', 'CMS MariaDB', 'Graph Neo4j', 'Queue RabbitMQ', 'Dev PostgreSQL', 'Test MySQL', 'Archive S3 Parquet'];
  const databases = names.map((name, index) => ({ id: index + 1, name, host: 'localhost', port: 5432, db_type: 'PostgreSQL', status: 'healthy', size_mb: 1024, total_queries: 100, slow_queries: 1 }));
  const queries = names.map((db_name, index) => ({ id: index + 1, db_name, query_text: 'SELECT * FROM users', query_type: 'SELECT', table_name: 'users', execution_time_ms: 120 }));
  const indexes = names.map((db_name, index) => ({ id: index + 1, db_name, table_name: 'users', column_name: 'created_at', index_type: 'btree', impact_score: 70, status: 'suggested' }));
  const backups = names.map((db_name, index) => ({ id: index + 1, db_name, backup_type: 'full', size_mb: 1024, status: 'completed', started_at: '2026-10-10T00:00:00Z', completed_at: '2026-10-10T01:00:00Z' }));
  const records = { databases, queries, indexes, backups };
  global.fetch = jest.fn(async (url) => ({ ok: true, json: async () => ({ data: records[url.split('?')[0].split('/').pop()], pagination: { page: 1, total: 18 } }) }));
  const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
  for (const Page of [DatabasesPage, QueriesPage, IndexesPage, BackupsPage]) {
    const view = mount(<Page />); await view.render();
    await act(async () => { await Promise.resolve(); });
    expect(view.host.querySelectorAll('tbody tr')).toHaveLength(18);
    await view.cleanup();
  }
  expect(errors).not.toHaveBeenCalled();
});

test('record API rejects malformed and failed list responses instead of hiding route errors', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ data: { unexpected: true } }) }));
  await expect(api.getDatabases()).rejects.toThrow('Expected a record list');
  global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'Database unavailable' }) }));
  await expect(api.getQueries()).rejects.toThrow('Database unavailable');
});
