pub mod audio;
pub mod commands;
pub mod core;
pub mod models;
pub mod scheduler;

use std::sync::Mutex;

pub use core::StationCore;

pub struct StationState {
    pub core: Mutex<StationCore>,
}

impl StationState {
    pub fn new(core: StationCore) -> Self {
        Self {
            core: Mutex::new(core),
        }
    }
}
