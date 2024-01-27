import { useRef, useState } from "react";
import { isTestDone } from "../util/test";
import Diff from "./Diff";
import Result from "./Result";
import { useCharCounts } from "./useCharCounts";
import "./BoundedTypingTest.css";
import VerticalSpacer from "../common/VerticalSpacer";
import { ANTI_CHEAT_PROPS } from "../util/component";
import { usePreference } from "../context/preferences";

export interface BoundedTypingTestProps {
  test: string[];
  enabled?: boolean;
  onStart?: () => void;
  onUpdate?: (previousAttempt: string[], currentAttempt: string[]) => void;
  onFinish?: (attempt: string[], duration: number) => void;
  options?: {
    allowSkipping?: boolean;
    allowBackpedal?: boolean;
  };
}

const BoundedTypingTest = ({
  test,
  enabled,
  onStart,
  onUpdate,
  onFinish,
  options,
}: BoundedTypingTestProps) => {
  const [showAllLines] = usePreference("showAllLines");

  const [attempt, setAttempt] = useState("".split(" "));

  const [start, setStart] = useState<number | undefined>(undefined);
  const [end, setEnd] = useState<number | undefined>(undefined);

  const [charCounts, updateCharCounts] = useCharCounts();

  const [progress, setProgress] = useState(0);

  const handleInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (enabled !== undefined && !enabled) {
      return;
    }
    if (!start) {
      setStart(performance.now());
      if (onStart) onStart();
    }
    if (!end) {
      const previousAttempt = attempt;

      const currentAttempt = event.target.value.split(" ");
      if (
        currentAttempt.length <= test.length &&
        currentAttempt[currentAttempt.length - 1].length >
          test[currentAttempt.length - 1].length + 20
      ) {
        return;
      }
      if (
        options?.allowSkipping !== undefined &&
        !options?.allowSkipping &&
        currentAttempt.length > previousAttempt.length &&
        currentAttempt[previousAttempt.length - 1] !==
          test[previousAttempt.length - 1]
      ) {
        return;
      }
      setAttempt(currentAttempt);
      setProgress(currentAttempt.length - 1);

      updateCharCounts(test, previousAttempt, currentAttempt);

      if (onUpdate) onUpdate(previousAttempt, currentAttempt);

      if (isTestDone(test, currentAttempt)) {
        const end = performance.now();
        setEnd(end);
        if (onFinish) onFinish(currentAttempt, end - start!);
      }
    }
  };

  const inputRef = useRef<HTMLInputElement>(null);
  const handleClick = () => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  return (
    <div className="BoundedTypingTest" onClick={handleClick}>
      <div
        className="Progress"
        style={{ visibility: !start || end ? "hidden" : "inherit" }}
      >
        {progress} / {test.length}
      </div>
      <Diff test={test} attempt={attempt} showAllLines={showAllLines} />
      <input
        type="text"
        value={attempt.join(" ")}
        ref={inputRef}
        className="Hide"
        onInput={handleInput}
        autoFocus
        {...ANTI_CHEAT_PROPS}
      />
      {start && end && (
        <>
          <VerticalSpacer />
          <Result
            test={test}
            attempt={attempt}
            duration={(end - start) / 1000}
            charCounts={charCounts}
          />
        </>
      )}
    </div>
  );
};

export default BoundedTypingTest;