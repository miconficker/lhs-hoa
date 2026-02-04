import { useAuth } from "@/hooks/useAuth";

export function DebugPage() {
  const { user, token, initialized } = useAuth();

  return (
    <div className="p-6 space-y-4 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold">Debug Auth State</h1>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Auth State:</h2>
        <p>Initialized: {initialized ? "Yes" : "No"}</p>
        <p>User: {user ? JSON.stringify(user, null, 2) : "null"}</p>
        <p>Token (first 50 chars): {token ? token.substring(0, 50) + "..." : "null"}</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">localStorage:</h2>
        <p>hoa_token: {localStorage.getItem("hoa_token")?.substring(0, 50) || "not set"}...</p>
        <p>hoa_user: {localStorage.getItem("hoa_user") || "not set"}</p>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Tests:</h2>
        <button
          onClick={() => {
            console.log("Auth state:", { user, token, initialized });
            console.log("localStorage:", {
              token: localStorage.getItem("hoa_token"),
              user: localStorage.getItem("hoa_user"),
            });
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Log Auth State to Console
        </button>
      </div>
    </div>
  );
}
