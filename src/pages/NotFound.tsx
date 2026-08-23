import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import AuthShell from "@/chronicle/shared/AuthShell";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <AuthShell
      title="Page not found"
      lede="That address does not lead to a Chronicle page."
      footer="Your records have not been affected."
    >
      <div className="proto-form">
        <div className="rounded-xl border border-border bg-card/70 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Address checked</p>
          <p className="mt-1 break-all text-[13px] text-foreground">{location.pathname}</p>
        </div>
        <Link className="proto-btn text-center" data-variant="primary" to="/">
          Return to Chronicle
        </Link>
      </div>
    </AuthShell>
  );
};

export default NotFound;
