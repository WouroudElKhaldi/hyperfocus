import { Link, type RouteComponent, createRootRoute, createRoute, createRouter, lazyRouteComponent } from "@tanstack/react-router";
import App from "./App.tsx";
import Tasks from "./pages/Tasks.tsx";
import Today from "./pages/Today.tsx";

// Every page of the website as a typed route (P3-04, TanStack Router). The addresses are the same as before, so old
// links and bookmarks keep working. Links and navigation are checked against this list: a link to a page that doesn't
// exist, or without the parameter a page needs, is a type error. Pages load the first time they are opened.

const Notes = lazyRouteComponent(() => import("./pages/Notes.tsx"));
const Goals = lazyRouteComponent(() => import("./pages/Goals.tsx"));
const Skills = lazyRouteComponent(() => import("./pages/Skills.tsx"));
const Review = lazyRouteComponent(() => import("./pages/Review.tsx"));
const Wins = lazyRouteComponent(() => import("./pages/Wins.tsx"));
const Backup = lazyRouteComponent(() => import("./pages/Backup.tsx"));
const Books = lazyRouteComponent(() => import("./pages/Books.tsx"));
const BookDetail = lazyRouteComponent(() => import("./pages/BookDetail.tsx"));
const Study = lazyRouteComponent(() => import("./pages/Study.tsx"));
const Calendar = lazyRouteComponent(() => import("./pages/Calendar.tsx"));
const Posts = lazyRouteComponent(() => import("./pages/Posts.tsx"));
const PostEditor = lazyRouteComponent(() => import("./pages/PostEditor.tsx"));
const Emails = lazyRouteComponent(() => import("./pages/Emails.tsx"));
const EmailEditor = lazyRouteComponent(() => import("./pages/EmailEditor.tsx"));
const Jobs = lazyRouteComponent(() => import("./pages/Jobs.tsx"));
const JobDetail = lazyRouteComponent(() => import("./pages/JobDetail.tsx"));
const Chat = lazyRouteComponent(() => import("./pages/Chat.tsx"));
const Pet = lazyRouteComponent(() => import("./pages/Pet.tsx"));
const Profile = lazyRouteComponent(() => import("./pages/Profile.tsx"));
// the design system page (P3-02): development only, so it never ships in the built app
const DevUi = import.meta.env.DEV ? lazyRouteComponent(() => import("./pages/DevUi.tsx")) : null;

/** An address that isn't a page: say so kindly, with one way back. */
function NotFound() {
  return (
    <>
      <h1>This page doesn't exist</h1>
      <p className="sub">The link may be old or mistyped. Nothing is lost.</p>
      <Link className="btn primary" to="/">
        Back to Today
      </Link>
    </>
  );
}

const root = createRootRoute({ component: App, notFoundComponent: NotFound });
const page = <P extends string>(path: P, component: RouteComponent) => createRoute({ getParentRoute: () => root, path, component });

const routes = [
  page("/", Today),
  page("/notes", Notes),
  page("/tasks", Tasks),
  page("/goals", Goals),
  page("/skills", Skills),
  page("/review", Review),
  page("/wins", Wins),
  page("/backup", Backup),
  page("/books", Books),
  page("/books/$slug", BookDetail),
  page("/study", Study),
  page("/calendar", Calendar),
  page("/posts", Posts),
  page("/posts/$id", PostEditor),
  page("/emails", Emails),
  page("/emails/$id", EmailEditor),
  page("/jobs", Jobs),
  page("/jobs/$id", JobDetail),
  page("/chat", Chat),
  page("/pet", Pet),
  page("/profile", Profile),
] as const;
const devRoutes = DevUi ? [page("/dev/ui", DevUi)] : [];

export const router = createRouter({ routeTree: root.addChildren([...routes, ...devRoutes]), scrollRestoration: false });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
