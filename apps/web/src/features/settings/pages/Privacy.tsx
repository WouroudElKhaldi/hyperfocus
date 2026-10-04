import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";

// The privacy policy (P5-12), in plain words. Reachable signed out too (/privacy), from the sign-up page and Settings.
// It describes what this app really does; the website's owner should still have it checked for their country's law.

export default function Privacy({ signedOut = false }: { signedOut?: boolean }) {
  useTranslation(); // (re-renders this page when the language changes)
  return (
    <div className="guide privacy">
      <h1>{i18next.t("settings.privacy")}</h1>
      <p className="sub">{i18next.t("settings.whatHyperfocusKeepsAbout")}</p>

      <section className="card" aria-labelledby="pv-what">
        <h2 id="pv-what">{i18next.t("settings.whatWeKeep")}</h2>
        <ul>
          <li><b>{i18next.t("settings.yourAccount")}</b> {i18next.t("settings.yourFullNameEmail")}</li>
          <li><b>{i18next.t("settings.whatYouPutIn")}</b> {i18next.t("settings.tasksNotesGoalsReminders")}</li>
          <li><b>{i18next.t("settings.yourConnections")}</b> {i18next.t("settings.onlyIfYouAdd")} <b>{i18next.t("settings.encrypted")}</b> {i18next.t("settings.beforeTheyAreStored")}</li>
          <li><b>{i18next.t("settings.technical")}</b> {i18next.t("settings.yourSignInSessions")}</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="pv-why">
        <h2 id="pv-why">{i18next.t("settings.why")}</h2>
        <p>{i18next.t("settings.onlyToRunThe")} <b>{i18next.t("settings.noAdvertisingNoSelling")}</b> {i18next.t("settings.companies")}</p>
      </section>

      <section className="card" aria-labelledby="pv-who">
        <h2 id="pv-who">{i18next.t("settings.whoSeesIt")}</h2>
        <ul>
          <li><b>{i18next.t("settings.otherPeopleUsingHyperfocus")}</b> {i18next.t("settings.everyRequestIsChecked")}</li>
          <li>{i18next.t("settings.theWebsiteS")} <b>{i18next.t("settings.admins")}</b> {i18next.t("settings.seeTheListOf")}</li>
          <li><b>{i18next.t("settings.servicesThatDoWork")}</b> {i18next.t("settings.receiveOnlyWhatThat")}
            <ul>
              <li>{i18next.t("settings.deepseekTheAiThe")}</li>
              <li>{i18next.t("settings.googleGmailTheEmails")}</li>
              <li>{i18next.t("settings.yourN8nAndLinkedin")}</li>
              <li>{i18next.t("settings.yourBrowserSPush")}</li>
            </ul>
          </li>
        </ul>
      </section>

      <section className="card" aria-labelledby="pv-keep">
        <h2 id="pv-keep">{i18next.t("settings.howLong")}</h2>
        <p>{i18next.t("settings.asLongAsYou")} <b>{i18next.t("settings.settingsYourDataAnd")}</b> {i18next.t("settings.youCanHaveYour")}</p>
      </section>

      <section className="card" aria-labelledby="pv-rights">
        <h2 id="pv-rights">{i18next.t("settings.yourChoices")}</h2>
        <ul>
          <li><b>{i18next.t("settings.takeItWithYou")}</b> {i18next.t("settings.settings2")} <b>{i18next.t("settings.exportMyData2")}</b> {i18next.t("settings.givesYouEverythingYou")}</li>
          <li><b>{i18next.t("settings.correctIt")}</b> {i18next.t("settings.changeAnythingInThe")}</li>
          <li><b>{i18next.t("settings.deleteIt")}</b> {i18next.t("settings.settings2")} <b>{i18next.t("settings.deleteMyAccount")}</b> {i18next.t("settings.removesYourAccountAnd")}</li>
          <li><b>{i18next.t("settings.stopEmailsAndNotifications")}</b> {i18next.t("settings.settingsWhereNotificationsGo")}</li>
          <li><b>{i18next.t("settings.questionsOrRequests")}</b> {i18next.t("settings.writeToTheWebsite")}</li>
        </ul>
      </section>

      <section className="card" aria-labelledby="pv-safe">
        <h2 id="pv-safe">{i18next.t("settings.keepingItSafe")}</h2>
        <p>{i18next.t("settings.connectionsAreEncryptedHttps")}</p>
      </section>

      <p className="muted">{signedOut ? <Link to="/">{i18next.t("settings.back")}</Link> : <Link to="/backup">{i18next.t("settings.backToSettings")}</Link>}</p>
    </div>
  );
}
