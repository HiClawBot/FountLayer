import { loginConsoleOperator } from "./actions";

type LoginPageProps = {
  searchParams: Promise<{
    error?: string | string[];
    next?: string | string[];
  }>;
};

function first(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const parameters = await searchParams;
  const configured =
    /^[a-f0-9]{64}$/iu.test(
      process.env.CONSOLE_OPERATOR_TOKEN_SHA256?.trim() ?? "",
    ) && (process.env.CONSOLE_SESSION_SECRET?.length ?? 0) >= 32;
  const invalid = first(parameters.error) === "invalid";

  return (
    <div className="login-page">
      <div className="login-panel">
        <div className="login-brand">FountLayer</div>
        <h1>Operator sign in</h1>
        <p>
          Enter the high-entropy Console operator token. The token is exchanged
          for an eight-hour, HttpOnly session and is never stored in browser
          storage.
        </p>
        {!configured ? (
          <div className="auth-message danger">
            Console authentication is not configured. Set the operator token
            digest and session secret before exposing this service.
          </div>
        ) : null}
        {invalid ? (
          <div className="auth-message danger">
            The operator token is invalid or authentication is unavailable.
          </div>
        ) : null}
        <form action={loginConsoleOperator} className="login-form">
          <input
            autoComplete="username"
            name="username"
            type="hidden"
            value="operator"
          />
          <input name="next" type="hidden" value={first(parameters.next)} />
          <label className="field">
            <span>Operator access token</span>
            <input
              autoComplete="current-password"
              disabled={!configured}
              name="operatorToken"
              required
              type="password"
            />
          </label>
          <button
            className="primary-button"
            disabled={!configured}
            type="submit"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
