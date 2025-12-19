import * as React from "https://esm.sh/react@18";

// Syncs status/logs/code from the traitlets model with cleanup.
export default function useModelSync(model) {
  const [status, setStatus] = React.useState(model.get("status"));
  const [logs, setLogs] = React.useState(model.get("logs"));
  const [code, setCode] = React.useState(model.get("code"));
  const [errorMessage, setErrorMessage] = React.useState(model.get("error_message"));

  React.useEffect(() => {
    const onStatusChange = () => setStatus(model.get("status"));
    const onLogsChange = () => setLogs(model.get("logs"));
    const onCodeChange = () => setCode(model.get("code"));
    const onErrorChange = () => setErrorMessage(model.get("error_message"));

    model.on("change:status", onStatusChange);
    model.on("change:logs", onLogsChange);
    model.on("change:code", onCodeChange);
    model.on("change:error_message", onErrorChange);

    return () => {
      model.off("change:status", onStatusChange);
      model.off("change:logs", onLogsChange);
      model.off("change:code", onCodeChange);
      model.off("change:error_message", onErrorChange);
    };
  }, [model]);

  return { status, logs, code, errorMessage };
}
