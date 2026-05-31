use crate::station::models::{StationDevice, StationTransportPatch, StationTransportState};

#[derive(Debug, Default)]
#[allow(dead_code)]
pub struct StationMixer {
    transport: StationTransportState,
    mic_live: bool,
    duck_db: i64,
}

#[allow(dead_code)]
impl StationMixer {
    pub fn transport(&self) -> StationTransportState {
        self.transport.clone()
    }

    pub fn patch_transport(&mut self, patch: StationTransportPatch) -> StationTransportState {
        if let Some(playing) = patch.playing {
            self.transport.playing = playing;
        }
        if let Some(current) = patch.current_asset_id {
            self.transport.current_asset_id = current;
        }
        if let Some(queue) = patch.queue_asset_ids {
            self.transport.queue_asset_ids = queue;
        }
        if let Some(position) = patch.position_sec {
            self.transport.position_sec = position.max(0.0);
        }
        if let Some(deck) = patch.active_deck {
            if deck == "A" || deck == "B" {
                self.transport.active_deck = deck;
            }
        }
        self.transport.clone()
    }

    pub fn set_mic(&mut self, live: bool, duck_db: i64) {
        self.mic_live = live;
        self.duck_db = duck_db.clamp(-60, 0);
    }

    pub fn program_gain(&self) -> f64 {
        if self.mic_live {
            10_f64.powf(self.duck_db as f64 / 20.0)
        } else {
            1.0
        }
    }
}

#[cfg(target_os = "windows")]
pub fn list_audio_devices() -> Vec<StationDevice> {
    use cpal::traits::{DeviceTrait, HostTrait};

    let mut devices = Vec::new();
    for host_id in cpal::available_hosts() {
        let Ok(host) = cpal::host_from_id(host_id) else {
            continue;
        };
        let host_name = match host_id {
            cpal::HostId::Asio => "ASIO",
            cpal::HostId::Wasapi => "WASAPI",
            _ => "Unknown",
        };
        let Ok(list) = host.devices() else {
            continue;
        };
        for (index, device) in list.enumerate() {
            let name = device
                .name()
                .unwrap_or_else(|_| "Unknown device".to_string());
            let input_channels = device
                .default_input_config()
                .map(|cfg| cfg.channels() as usize)
                .unwrap_or(0);
            let output_channels = device
                .default_output_config()
                .map(|cfg| cfg.channels() as usize)
                .unwrap_or(0);
            let default_sample_rate = device
                .default_output_config()
                .map(|cfg| cfg.sample_rate().0)
                .or_else(|_| device.default_input_config().map(|cfg| cfg.sample_rate().0))
                .unwrap_or(48_000);
            devices.push(StationDevice {
                id: format!("{host_name}-{index}-{name}"),
                name,
                host: host_name.to_string(),
                input_channels,
                output_channels,
                sample_rates: vec![44_100, 48_000],
                default_sample_rate,
            });
        }
    }
    devices
}

#[cfg(not(target_os = "windows"))]
pub fn list_audio_devices() -> Vec<StationDevice> {
    vec![StationDevice {
        id: "development-placeholder".to_string(),
        name: "ASIO device discovery is enabled in Windows builds".to_string(),
        host: "Unknown".to_string(),
        input_channels: 0,
        output_channels: 0,
        sample_rates: vec![48_000],
        default_sample_rate: 48_000,
    }]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mixer_transport_patch_updates_state() {
        let mut mixer = StationMixer::default();
        let state = mixer.patch_transport(StationTransportPatch {
            playing: Some(true),
            current_asset_id: Some(Some("asset-1".into())),
            queue_asset_ids: Some(vec!["asset-1".into(), "asset-2".into()]),
            position_sec: Some(12.5),
            active_deck: Some("B".into()),
        });

        assert!(state.playing);
        assert_eq!(state.current_asset_id.as_deref(), Some("asset-1"));
        assert_eq!(state.active_deck, "B");
        assert_eq!(state.queue_asset_ids.len(), 2);
    }

    #[test]
    fn mixer_ducks_program_gain_when_mic_live() {
        let mut mixer = StationMixer::default();
        assert_eq!(mixer.program_gain(), 1.0);
        mixer.set_mic(true, -20);
        assert!(mixer.program_gain() < 0.11);
    }
}
