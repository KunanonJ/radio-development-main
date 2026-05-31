use crate::station::models::BroadcastSchedulerEvent;

#[allow(dead_code)]
pub fn event_matches_second(event: &BroadcastSchedulerEvent, weekday: i64, hh_mm_ss: &str) -> bool {
    if !event.enabled {
        return false;
    }
    if event.time != hh_mm_ss {
        return false;
    }
    event.days_of_week.is_empty() || event.days_of_week.contains(&weekday)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn event() -> BroadcastSchedulerEvent {
        BroadcastSchedulerEvent {
            id: "evt-1".into(),
            name: "Top hour".into(),
            asset_id: "asset-1".into(),
            time: "08:00:00".into(),
            days_of_week: vec![1, 2, 3],
            mode: "interrupt".into(),
            enabled: true,
            created_at: "2026-05-31T00:00:00Z".into(),
            updated_at: "2026-05-31T00:00:00Z".into(),
        }
    }

    #[test]
    fn scheduler_event_matches_configured_weekday_and_second() {
        let evt = event();
        assert!(event_matches_second(&evt, 1, "08:00:00"));
        assert!(!event_matches_second(&evt, 0, "08:00:00"));
        assert!(!event_matches_second(&evt, 1, "08:00:01"));
    }

    #[test]
    fn scheduler_event_with_empty_days_runs_every_day() {
        let mut evt = event();
        evt.days_of_week.clear();
        assert!(event_matches_second(&evt, 6, "08:00:00"));
    }
}
