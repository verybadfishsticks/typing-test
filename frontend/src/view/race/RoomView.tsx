import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useService } from "../../service";
import { AccountService } from "../../service/account";
import { Button } from "@mui/material";
import BoundedTypingTest from "../../typing-test/BoundedTypingTest";
import { TestFinishEvent } from "../../typing-test/props";
import { NotificationsService } from "../../service/notifications";

const TEST = (
  "Hey what is going on right now? Nobody told me about this. " +
  "Could somebody please tell me what the hell is going on in " +
  "this place for god's sake?!"
).split(" ");

function RoomView() {
  const { room } = useParams();

  const { addNotification } = useService(NotificationsService);
  const { accountState } = useService(AccountService);
  const socket = useRef<WebSocket | null>(null);

  const [state, setState] = useState<State>({ kind: "notReady" });
  const [otherPlayers, setOtherPlayers] = useState<OtherPlayer[]>([]);

  const handleMessage = (msg: Msg) => {
    console.log(msg);

    const { kind, payload } = msg;

    switch (kind) {
      case "init":
        setOtherPlayers(
          payload.otherPlayerUsernames.map((username) => {
            return { username, state: { kind: "notReady" } };
          }),
        );
        break;
      case "join":
        setOtherPlayers((players) => [
          ...players,
          { username: payload.joiningPlayer, state: { kind: "notReady" } },
        ]);
        break;
      case "leave":
        setOtherPlayers((players) =>
          players.filter((player) => player.username != payload.leavingPlayer),
        );
        break;
      case "ready":
        setOtherPlayers((players) =>
          players.map((player) =>
            player.username == payload.readyPlayer
              ? { ...player, state: { kind: "ready" } }
              : player,
          ),
        );
        break;
      case "notReady":
        setOtherPlayers((players) =>
          players.map((player) =>
            player.username == payload.notReadyPlayer
              ? { ...player, state: { kind: "notReady" } }
              : player,
          ),
        );
        break;
      case "prepare":
        setState({
          kind: "ready",
          timeUntilRaceStart: payload.timeUntilRaceStart,
        });
        const interval = setInterval(() => {
          setState((state) => {
            if (state.kind !== "ready") {
              return state;
            }
            const timeLeft = state.timeUntilRaceStart!.secs - 1;
            if (timeLeft == 0) {
              setState({ kind: "racing" });
              setOtherPlayers((otherPlayers) =>
                otherPlayers.map((otherPlayer) => {
                  return {
                    ...otherPlayer,
                    state: { kind: "racing", progress: 0 },
                  };
                }),
              );
              clearInterval(interval);
            }
            return {
              kind: "ready",
              timeUntilRaceStart: {
                secs: timeLeft,
              },
            };
          });
        }, 1000);
        break;
      case "update":
        const { player: updatingPlayer, progress } = payload;
        setOtherPlayers((otherPlayers) => {
          const index = otherPlayers.findIndex(
            (otherPlayer) => otherPlayer.username === updatingPlayer,
          );
          return otherPlayers.with(index, {
            username: updatingPlayer,
            state: { kind: "racing", progress },
          });
        });
        break;
      case "finish":
        const { player: finishedPlayer, duration } = payload;
        setOtherPlayers((otherPlayers) => {
          const index = otherPlayers.findIndex(
            (otherPlayer) => otherPlayer.username === finishedPlayer,
          );
          return otherPlayers.with(index, {
            username: finishedPlayer,
            state: { kind: "finished", duration },
          });
        });
        break;
      case "error":
        const { title, body } = payload;
        addNotification({ type: "Error", title, body });
        break;
    }
  };

  const sendReady = () => {
    if (socket.current === null) {
      return;
    }
    const msg = { kind: "ready", payload: {} };
    socket.current.send(JSON.stringify(msg));
    setState({ kind: "ready" });
  };

  const sendNotReady = () => {
    if (socket.current === null) {
      return;
    }
    const msg = { kind: "notReady", payload: {} };
    socket.current.send(JSON.stringify(msg));
    setState({ kind: "notReady" });
  };

  const handleTestUpdate = (attempt: string[], newAttempt: string[]) => {
    if (socket.current === null || attempt.length === newAttempt.length) {
      return;
    }
    const msg = { kind: "update", payload: { progress: newAttempt.length } };
    socket.current.send(JSON.stringify(msg));
  };

  const handleTestFinish = (event: TestFinishEvent) => {
    if (socket.current === null) {
      return;
    }
    const { duration } = event;
    const msg = {
      kind: "finish",
      payload: {
        duration: {
          secs: Math.floor(duration),
          nanos: Math.floor(duration * 1_000_000_000) % 1_000_000_000,
        },
      },
    };
    socket.current.send(JSON.stringify(msg));
    setState({
      kind: "finished",
      duration: {
        secs: Math.floor(duration),
        nanos: Math.floor(duration * 1_000_000_000) % 1_000_000_000,
      },
    });
  };

  useEffect(() => {
    if (accountState.state !== "signedin") {
      return;
    }
    socket.current = new WebSocket(
      `ws://localhost:8080/room/join?roomId=${room}`,
    );
    socket.current.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data) as Msg;
      handleMessage(msg);
    });
    return () => {
      if (socket.current) {
        socket.current.close();
        socket.current = null;
      }
    };
  }, [accountState]);

  if (accountState.state !== "signedin") {
    return (
      <div className="RoomView">Please sign in to participate in races.</div>
    );
  }

  return (
    <div className="RoomView">
      {state.kind === "notReady" && (
        <Button variant="contained" onClick={sendReady}>
          Ready
        </Button>
      )}
      {state.kind === "ready" &&
        (state.timeUntilRaceStart ? (
          `Race starts in ${state.timeUntilRaceStart.secs} seconds`
        ) : (
          <Button variant="contained" onClick={sendNotReady}>
            NotReady
          </Button>
        ))}
      {(state.kind === "ready" || state.kind === "notReady") &&
        otherPlayers.map((player, i) => (
          <div key={i}>
            {player.username} {player.state.kind}
          </div>
        ))}
      {state.kind === "racing" && (
        <BoundedTypingTest
          test={TEST}
          onTestUpdate={handleTestUpdate}
          onTestFinish={handleTestFinish}
          allowSkippingWords={false}
        />
      )}
      {state.kind === "finished" && (
        <>
          You finished the race in{" "}
          {state.duration.secs + state.duration.nanos / 1_000_000_000} seconds!
          {otherPlayers.map(({ username, state }, i) => (
            <div key={i}>
              {username} {state.kind === "racing" && state.progress}
              {state.kind === "finished" &&
                `Finished in ${state.duration.secs + state.duration.nanos / 1_000_000_000
                }`}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

type State = NotReadyState | ReadyState | RacingState | FinishedState;

interface NotReadyState {
  kind: "notReady";
}

interface ReadyState {
  kind: "ready";
  // Not populated for other player states.
  timeUntilRaceStart?: { secs: number };
}

interface RacingState {
  kind: "racing";
  // Populated only for other player states.
  progress?: number;
}

interface FinishedState {
  kind: "finished";
  duration: { secs: number; nanos: number };
}

interface OtherPlayer {
  username: string;
  state: State;
}

type Msg =
  | InitMsg
  | JoinMsg
  | LeaveMsg
  | ReadyMsg
  | NotReadyMsg
  | PrepareMsg
  | UpdateMsg
  | FinishMsg
  | ErrorMsg;

interface InitMsg {
  kind: "init";
  payload: {
    otherPlayerUsernames: string[];
  };
}

interface JoinMsg {
  kind: "join";
  payload: {
    joiningPlayer: string;
  };
}

interface LeaveMsg {
  kind: "leave";
  payload: {
    leavingPlayer: string;
  };
}

interface ReadyMsg {
  kind: "ready";
  payload: {
    readyPlayer: string;
  };
}

interface NotReadyMsg {
  kind: "notReady";
  payload: {
    notReadyPlayer: string;
  };
}

interface PrepareMsg {
  kind: "prepare";
  payload: {
    timeUntilRaceStart: { secs: number };
  };
}

interface UpdateMsg {
  kind: "update";
  payload: {
    player: string;
    progress: number;
  };
}

interface FinishMsg {
  kind: "finish";
  payload: {
    player: string;
    duration: { secs: number; nanos: number };
  };
}

interface ErrorMsg {
  kind: "error";
  payload: {
    title: string;
    body: string;
  };
}

export default RoomView;
