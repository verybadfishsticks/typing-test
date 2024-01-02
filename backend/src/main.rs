use axum::handler::Handler;
use axum::http::header::CONTENT_TYPE;
use axum::http::{HeaderValue, Method};
use axum::middleware::map_response;
use axum::routing::{get, post};
use axum::Router;
use common::state::AppState;
use dotenv::dotenv;
use lettre::Message;
use tower_http::cors::CorsLayer;

mod auth;
mod common;
mod typing_test;

mod results;
use results::*;

mod preferences;
use preferences::*;

mod experimental;
use experimental::*;

#[allow(dead_code)]
fn get_email() -> Result<Message, anyhow::Error> {
    let email = Message::builder()
        .from("Joseph <epicjoe128@gmail.com>".parse()?)
        .reply_to("Joseph <epicjoe128@gmail.com>".parse()?)
        .to("Joseph <epicjoe128@gmail.com>".parse()?)
        .subject("Test email")
        .body(String::from("Testing this"))?;
    Ok(email)
}

#[tokio::main]
async fn main() {
    dotenv().ok();

    let app = Router::new()
        .route("/test", post(typing_test::post_test))
        .route("/test/:id", get(typing_test::get_test))
        .route("/quote", get(typing_test::get_random_quote))
        .route("/quote/:id", get(typing_test::get_quote))
        .route("/result", get(get_results).post(post_result))
        .route("/signup", post(auth::sign_up))
        .route("/signin", post(auth::sign_in))
        .route(
            "/current",
            get(auth::current_user.layer(map_response(auth::refresh_auth_token))),
        )
        .route("/logout", get(auth::log_out))
        .route("/prefs", post(update_preferences))
        .route("/experimental", get(experimental))
        .with_state(AppState::new().await)
        .layer(
            CorsLayer::new()
                .allow_origin(
                    "http://localhost:3000"
                        .parse::<HeaderValue>()
                        .expect("no error"),
                )
                .allow_methods([Method::GET, Method::POST])
                .allow_headers([CONTENT_TYPE])
                .allow_credentials(true),
        );

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080")
        .await
        .expect("no error");
    axum::serve(listener, app).await.expect("no error");
}
