"""Synthetic producer examples. Routing belongs to the producer, not the dispatcher."""
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from .core import utc_now

CREW = ["CM-1", "CM-2", "CM-3"]
SCENARIOS = {
    "mild": "Aviso leve personal",
    "reminder": "Actividad de protocolo mañana",
    "assistance": "Solicitud de asistencia",
    "critical": "Urgencia dentro de la nave",
    "eva": "Urgencia durante EVA",
}


def make_scenario(scenario, crew_id, crew_ids=None):
    crew_ids = crew_ids or CREW
    if scenario not in SCENARIOS or crew_id not in crew_ids:
        raise ValueError("unknown scenario or demo crew")
    urgent = scenario in {"critical", "eva"}
    assistance = scenario == "assistance"
    priority = "critical" if urgent else "warning" if scenario != "reminder" else "info"
    tomorrow = (datetime.now(timezone.utc) + timedelta(days=1)).date().isoformat()
    texts = {
        "mild": "Hay una actualización de tu seguimiento disponible. Revisala cuando puedas.",
        "reminder": f"Mañana ({tomorrow}) a las 10:00 UTC tenés la evaluación de fuerza programada en este protocolo de ejemplo.",
        "assistance": "Se solicitó apoyo de un compañero. Confirmá recepción si podés.",
        "critical": "Alerta urgente de simulación. El equipo y las rooms fueron avisados para asistencia inmediata.",
        "eva": "Alerta urgente EVA de simulación. Compañero EVA y operador a bordo avisados; salida por radio preparada.",
    }
    routes = [
        {"channel": "wearable", "recipient_id": crew_id, "content": texts[scenario]},
        {"channel": "earth", "recipient_id": "mission-control", "content": f"SIMULACIÓN · {crew_id} · {SCENARIOS[scenario]}: {texts[scenario]}"},
    ]
    if urgent or assistance:
        responders = [who for who in crew_ids if who != crew_id]
        if assistance:
            responders = responders[:1]
        for who in responders:
            routes.append({"channel": "wearable", "recipient_id": who,
                           "content": f"Asistencia solicitada para {crew_id}. Contexto simulado: {'EVA' if scenario == 'eva' else 'módulo de trabajo'}."})
    if urgent:
        routes.extend([
            {"channel": "room", "recipient_id": "operations", "content": f"SIMULACIÓN · Se requiere asistencia para {crew_id}. Contactar al equipo de respuesta."},
            {"channel": "ship_center", "recipient_id": "onboard", "content": f"SIMULACIÓN · {SCENARIOS[scenario]} · {crew_id}. Equipo de respuesta avisado."},
        ])
    if scenario == "eva":
        routes.append({"channel": "radio", "recipient_id": f"eva-{crew_id}",
                       "content": f"SIMULACIÓN · {crew_id}, alerta EVA. Operador y compañero notificados."})
    event_id = str(uuid4())
    message = {
        "schema_version": 1, "notification_id": f"demo:{event_id}", "revision": 1,
        "source": "scheduler-demo" if scenario == "reminder" else "health-service-demo",
        "source_event_id": event_id, "mission_id": "demo-mission", "crew_id": crew_id,
        "kind": "protocol_reminder" if scenario == "reminder" else "health_notice",
        "title": SCENARIOS[scenario], "message": texts[scenario], "priority": priority,
        "created_at": utc_now(), "state": "active", "requires_ack": urgent or assistance,
        "synthetic": True, "activity": "eva" if scenario == "eva" else "work", "deliveries": routes,
        "mission_location": {"mode": "body", "body_id": "499", "epoch": utc_now(), "source": "demo", "synthetic": True},
    }
    if scenario == "reminder":
        message["scheduled_for"] = f"{tomorrow}T10:00:00+00:00"
    return message
