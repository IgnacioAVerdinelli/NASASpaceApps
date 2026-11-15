const base = '/notifications-api/api/v1';

export async function request(path, body, signal) {
  const response = await fetch(`${base}${path}`, {
    signal,
    ...(body === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Notification API: ${response.status}`);
  }
  return response.json();
}

export function presentation(notification) {
  const [priority, level] = {
    info: ['Normal', 'low'], warning: ['Aviso', 'medium'], critical: ['Urgente', 'high'],
  }[notification.priority] || ['Sin prioridad', 'low'];
  return {
    ...notification, id: notification.delivery_id, priorityLabel: priority, level,
    time: new Date(notification.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' }),
  };
}
