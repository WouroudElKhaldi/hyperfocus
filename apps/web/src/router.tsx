import {
  Link,
  type RouteComponent,
  createRootRoute,
  createRoute,
  createRouter,
  lazyRouteComponent,
} from "@tanstack/react-router";
import App from "./App.tsx";

import Today from "./features/today/pages/Today.tsx";

// Every page of the website as a typed route (P3-04, TanStack Router). The addresses are the same as before, so old
// links and bookmarks keep working. Links and navigation are checked against this list: a link to a page that doesn't
// exist, or without the parameter a page needs, is a type error. Pages load the first time they are opened.

const Tasks = lazyRouteComponent(() => import("./features/tasks/pages/Tasks.tsx"));
const Notes = lazyRouteComponent(() => import("./features/notes/pages/Notes.tsx"));
const Goals = lazyRouteComponent(() => import("./features/goals/pages/Goals.tsx"));
const Skills = lazyRouteComponent(() => import("./features/skills/pages/Skills.tsx"));
const Review = lazyRouteComponent(() => import("./features/review/pages/Review.tsx"));
const Wins = lazyRouteComponent(() => import("./features/wins/pages/Wins.tsx"));
const Backup = lazyRouteComponent(() => import("./features/settings/pages/Backup.tsx"));
const Books = lazyRouteComponent(() => import("./features/books/pages/Books.tsx"));
const BookDetail = lazyRouteComponent(() => import("./features/books/pages/BookDetail.tsx"));
const Study = lazyRouteComponent(() => import("./features/study/pages/Study.tsx"));
const Calendar = lazyRouteComponent(() => import("./features/calendar/pages/Calendar.tsx"));
const Posts = lazyRouteComponent(() => import("./features/posts/pages/Posts.tsx"));
const PostEditor = lazyRouteComponent(() => import("./features/posts/pages/PostEditor.tsx"));
const Emails = lazyRouteComponent(() => import("./features/emails/pages/Emails.tsx"));
const EmailEditor = lazyRouteComponent(() => import("./features/emails/pages/EmailEditor.tsx"));
const Jobs = lazyRouteComponent(() => import("./features/jobs/pages/Jobs.tsx"));
const JobDetail = lazyRouteComponent(() => import("./features/jobs/pages/JobDetail.tsx"));
const Chat = lazyRouteComponent(() => import("./features/chat/pages/Chat.tsx"));
const Pet = lazyRouteComponent(() => import("./features/pet/pages/Pet.tsx"));
const Profile = lazyRouteComponent(() => import("./features/profile/pages/Profile.tsx"));
const Admin = lazyRouteComponent(() => import("./features/admin/pages/Admin.tsx")); // P5-06: admins only
// the design system page (P3-02): development only, so it never ships in the built app
// development pages: in development, and in the browser-test build (pnpm build:e2e sets VITE_DEV_PAGES); never in the app you use
const DEV_PAGES = import.meta.env.DEV || import.meta.env["VITE_DEV_PAGES"] === "1";
const DevUi = DEV_PAGES ? lazyRouteComponent(() => import("./features/dev/pages/DevUi.tsx")) : null;
// every pet drawing on one page (P3-15), for the visual test: development only too
const PetGallery = DEV_PAGES ? lazyRouteComponent(() => import("./features/dev/pages/PetGallery.tsx")) : null;
// plays every generated track and lists the silent ones (P3-16)
const SoundCheck = DEV_PAGES ? lazyRouteComponent(() => import("./features/dev/pages/SoundCheck.tsx")) : null;

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
const page = <P extends string>(path: P, component: RouteComponent) =>
  createRoute({ getParentRoute: () => root, path, component });

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
  page("/admin", Admin),
] as const;
const devRoutes = DevUi && PetGallery && SoundCheck ? [page("/dev/ui", DevUi), page("/dev/pet", PetGallery), page("/dev/sound", SoundCheck)] : [];

export const router = createRouter({
  routeTree: root.addChildren([...routes, ...devRoutes]),
  scrollRestoration: false,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
