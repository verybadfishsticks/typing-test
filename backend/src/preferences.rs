use axum::Json;
use serde::{Deserialize, Serialize};

use crate::{
    auth::AuthToken,
    common::{error::AppError, state::Db},
};

pub async fn update_preferences(
    db: Db,
    auth_token: AuthToken,
    Json(preferences): Json<Preferences>,
) -> Result<(), AppError> {
    let preferences = preferences.to_string();
    sqlx::query("UPDATE user SET preferences = ? WHERE id = ?")
        .bind(preferences)
        .bind(auth_token.user_id)
        .execute(&db)
        .await?;
    Ok(())
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preferences {
    current_mode: TypingTestMode,
    words_mode_length: u32,
    time_mode_duration: u32,
    language: String,
    quote_mode_min_length: u32,
    quote_mode_max_length: Option<u32>,
    max_chars_in_line: u32,
    show_all_lines: bool,
}

#[derive(Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum TypingTestMode {
    #[default]
    Words,
    Time,
    Quote,
}

#[derive(Debug, Default, Serialize, Deserialize)]
pub enum QuoteModeLength {
    Short,
    #[default]
    Medium,
    Long,
    VeryLong,
}

impl From<String> for Preferences {
    fn from(value: String) -> Self {
        serde_json::from_str(&value).expect("no error")
    }
}

impl ToString for Preferences {
    fn to_string(&self) -> String {
        serde_json::to_string(&self).expect("no error")
    }
}
