import i18next from "i18next";
import { useTranslation } from "react-i18next";
import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";

// "How do I get this?" (P5-07c, at your request): step-by-step guides for the three connections, written for people
// who don't work in tech. Each part of Settings → Your connections links to its section here (#ai, #gmail, #linkedin).

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="guide-steps">{children}</ol>;
}

export default function ConnectionsHelp() {
  useTranslation(); // (re-renders this page when the language changes)
  const hash = useRouterState({ select: (s) => s.location.hash });
  // open at the section you came for (after the page's own "back to the top" when it opens)
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }), 50);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div className="guide">
      <h1>{i18next.t("settings.howToConnectYour")}</h1>
      <p className="sub">
        {i18next.t("settings.threeShortGuidesOne")} <Link to="/backup">{i18next.t("settings.settingsYourConnections")}</Link>{i18next.t("settings.noTechnicalKnowledgeNeeded")}
      </p>
      <nav className="card" aria-label={i18next.t("settings.guides")}>
        <b>{i18next.t("settings.jumpTo")}</b> <a href="#ai">{i18next.t("settings.theAiDeepseekKey")}</a> · <a href="#gmail">{i18next.t("settings.emailGmail")}</a> · <a href="#linkedin">{i18next.t("settings.linkedinPosting")}</a> · <a href="#linkedin-n8n">{i18next.t("settings.linkedinThroughN8n")}</a>
      </nav>

      <section id="ai" className="card" aria-labelledby="ai-title">
        <h2 id="ai-title">{i18next.t("settings.n1TheAiYour")}</h2>
        <p>
          {i18next.t("settings.theAiWritesAnd")} <b>{i18next.t("settings.timeNeededAbout5")}</b> {i18next.t("settings.deepseekChargesVeryLittle")}
        </p>
        <Steps>
          <li>{i18next.t("settings.open")} <a href="https://platform.deepseek.com" target="_blank" rel="noreferrer">{i18next.t("settings.platformDeepseekCom")}</a> {i18next.t("settings.andSignUpWith")}</li>
          <li>{i18next.t("settings.onTheLeftClick")} <b>{i18next.t("settings.topUp")}</b> {i18next.t("settings.andAddASmall")}</li>
          <li>{i18next.t("settings.onTheLeftClick")} <b>{i18next.t("settings.apiKeys")}</b>{i18next.t("settings.thenComma")} <b>{i18next.t("settings.createNewApiKey")}</b>{i18next.t("settings.nameIt")} <i>{i18next.t("settings.hyperfocus")}</i> {i18next.t("settings.andClick")} <b>{i18next.t("settings.create")}</b>.</li>
          <li>
            {i18next.t("settings.aLongCodeStarting")} <code>{i18next.t("settings.sk")}</code> {i18next.t("settings.appearsClick")} <b>{i18next.t("settings.copy")}</b>. <b>{i18next.t("settings.itIsOnlyShown")}</b>{i18next.t("settings.ifYouCloseIt")}
          </li>
          <li>{i18next.t("settings.inHyperfocusOpen")} <Link to="/backup">{i18next.t("settings.settings")}</Link> → <b>{i18next.t("settings.yourConnections")}</b> → <b>{i18next.t("settings.aiDeepseek")}</b>{i18next.t("settings.pasteItAndClick")} <b>{i18next.t("settings.save")}</b>.</li>
        </Steps>
        <p className="muted">{i18next.t("settings.doneWhenItSays")} <i>{i18next.t("settings.connectedKeyEndingIn")}</i>{i18next.t("settings.toStopUsingIt")} <b>{i18next.t("settings.disconnect")}</b>{i18next.t("settings.youCanAlsoDelete")}</p>
      </section>

      <section id="gmail" className="card" aria-labelledby="gmail-title">
        <h2 id="gmail-title">{i18next.t("settings.n2EmailSendFrom")}</h2>
        <p>
          {i18next.t("settings.soTheEmailsYou")}
        </p>

        <h3>{i18next.t("settings.withAnAppPassword")}</h3>
        <p>{i18next.t("settings.anAppPasswordIs")}</p>
        <Steps>
          <li>
            {i18next.t("settings.open")} <a href="https://myaccount.google.com/security" target="_blank" rel="noreferrer">{i18next.t("settings.myaccountGoogleComSecurity")}</a> {i18next.t("settings.signInIfAsked")} <b>{i18next.t("settings.n2StepVerification")}</b>{i18next.t("settings.ifItSays")} <b>{i18next.t("settings.off")}</b>{i18next.t("settings.clickItAndFollow")} <b>{i18next.t("settings.on2")}</b> {i18next.t("settings.googleNeedsItBefore")}
          </li>
          <li>{i18next.t("settings.open")} <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">{i18next.t("settings.myaccountGoogleComApppasswords")}</a>.</li>
          <li>{i18next.t("settings.under")} <b>{i18next.t("settings.appName")}</b>{i18next.t("settings.type")} <i>{i18next.t("settings.hyperfocus")}</i> {i18next.t("settings.andClick")} <b>{i18next.t("settings.create")}</b>.</li>
          <li>{i18next.t("settings.googleShowsA16")} <code>{i18next.t("settings.abcdEfghIjklMnop")}</code>). Copy it. It is only shown once.</li>
          <li>
            {i18next.t("settings.inHyperfocus")} <Link to="/backup">{i18next.t("settings.settings")}</Link> → <b>{i18next.t("settings.yourConnections")}</b> → <b>{i18next.t("settings.emailGmail")}</b>{i18next.t("settings.typeYourGmailAddress")} <b>{i18next.t("settings.save")}</b>.
          </li>
        </Steps>
        <details>
          <summary>{i18next.t("settings.theAppPasswordsPage")}</summary>
          <p>
            {i18next.t("settings.thisHappensWhen2")}
          </p>
        </details>
        <p className="muted">{i18next.t("settings.toStopClick")} <b>{i18next.t("settings.disconnect")}</b> {i18next.t("settings.inHyperfocusAndYou")}</p>
      </section>

      <section id="linkedin" className="card" aria-labelledby="linkedin-title">
        <h2 id="linkedin-title">{i18next.t("settings.n3LinkedinPostingYour")}</h2>
        <p>
          {i18next.t("settings.soHyperfocusCanPublish")} <b>{i18next.t("settings.timeNeededAbout10")}</b>
        </p>
        <p className="muted">
          {i18next.t("settings.withoutItYouCan")} <b>{i18next.t("settings.copy")}</b> {i18next.t("settings.buttonAndYouPaste")}
        </p>

        <h3>{i18next.t("settings.stepAMakeYour")}</h3>
        <Steps>
          <li>
            {i18next.t("settings.open")} <a href="https://www.linkedin.com/developers/apps" target="_blank" rel="noreferrer">{i18next.t("settings.linkedinComDevelopersApps")}</a> {i18next.t("settings.signInWithYour")} <b>{i18next.t("settings.createApp")}</b>.
          </li>
          <li>
            {i18next.t("settings.appName2")} <i>{i18next.t("settings.myHyperfocusPosting")}</i>. <b>{i18next.t("settings.linkedinPage")}</b>{i18next.t("settings.linkedinRequiresACompany")} <b>{i18next.t("settings.forBusiness")}</b> → <b>{i18next.t("settings.createACompanyPage")}</b>); it can stay empty. Add a logo (any picture), tick
            the agreement, click <b>{i18next.t("settings.createApp")}</b>.
          </li>
          <li>{i18next.t("settings.openThe")} <b>{i18next.t("settings.products")}</b> {i18next.t("settings.tabAndClick")} <b>{i18next.t("settings.requestAccess")}</b> {i18next.t("settings.for")} <b>{i18next.t("settings.shareOnLinkedin")}</b> {i18next.t("settings.andFor")} <b>{i18next.t("settings.signInWithLinkedin")}</b> {i18next.t("settings.bothFreeApprovedAt")}</li>
        </Steps>

        <h3>{i18next.t("settings.stepBTellYour")}</h3>
        <Steps>
          <li>{i18next.t("settings.inHyperfocus")} <Link to="/backup">{i18next.t("settings.settings")}</Link> → <b>{i18next.t("settings.yourConnections")}</b> → <b>{i18next.t("settings.linkedinPosting")}</b> {i18next.t("settings.showsAnAddressEnding")} <code>{i18next.t("settings.apiIntegrationsLinkedinCallback")}</code>{i18next.t("settings.copyIt")}</li>
          <li>{i18next.t("settings.inYourLinkedinApp2")} <b>{i18next.t("settings.auth")}</b> {i18next.t("settings.tabUnder")} <b>{i18next.t("settings.authorizedRedirectUrlsFor")}</b>{i18next.t("settings.clickThePencilPaste")} <b>{i18next.t("settings.update")}</b>.</li>
        </Steps>

        <h3>{i18next.t("settings.stepCGiveHyperfocus")}</h3>
        <Steps>
          <li>{i18next.t("settings.stillOnThe")} <b>{i18next.t("settings.auth")}</b> {i18next.t("settings.tabCopyThe")} <b>{i18next.t("settings.clientId")}</b>{i18next.t("settings.andThe")} <b>{i18next.t("settings.primaryClientSecret")}</b> {i18next.t("settings.clickTheEyeTo")}</li>
          <li>{i18next.t("settings.inHyperfocus")} <b>{i18next.t("settings.linkedinPosting")}</b>{i18next.t("settings.pasteThemAndClick")} <b>{i18next.t("settings.save")}</b>{i18next.t("settings.theyAreLockedWhen")}</li>
          <li>{i18next.t("settings.click")} <b>{i18next.t("settings.connectLinkedin")}</b>{i18next.t("settings.linkedinAsksYouTo2")} <b>{i18next.t("settings.allow")}</b>{i18next.t("settings.youComeBackAnd")} <i>{i18next.t("settings.postingAs")}</i> {i18next.t("settings.yourName")}</li>
          <li>{i18next.t("settings.tryItWriteA")} <b>{i18next.t("settings.publish")}</b>{i18next.t("settings.itAppearsOnYour")}</li>
        </Steps>
        <p className="muted">
          {i18next.t("settings.linkedinAsksYouTo3")}
        </p>
      </section>

      <section id="linkedin-n8n" className="card" aria-labelledby="linkedin-n8n-title">
        <h2 id="linkedin-n8n-title">{i18next.t("settings.n4OrLinkedinThrough")}</h2>
        <p className="muted">
          {i18next.t("settings.onlyIfYouAlready")} <code>{i18next.t("settings.https")}</code> {i18next.t("settings.addressOneRunningOnly")}
        </p>
        <h3>{i18next.t("settings.stepARunN8n")}</h3>
        <Steps>
          <li>{i18next.t("settings.installNodeJsFree")} <a href="https://nodejs.org" target="_blank" rel="noreferrer">{i18next.t("settings.nodejsOrg")}</a> {i18next.t("settings.ifYouDonT")}</li>
          <li>{i18next.t("settings.openATerminalOn")} <i>{i18next.t("settings.terminal")}</i>), type <code>{i18next.t("settings.npxN8n")}</code> {i18next.t("settings.andPressEnterThe")}</li>
          <li>{i18next.t("settings.whenItSaysIt")} <a href="http://localhost:5678" target="_blank" rel="noreferrer">{i18next.t("settings.localhost5678")}</a> {i18next.t("settings.andMakeYourLocal")}</li>
          <li>{i18next.t("settings.click")} <b>{i18next.t("settings.createWorkflow")}</b> {i18next.t("settings.or")} <b>+</b> → <b>{i18next.t("settings.workflow")}</b>). Name it <i>{i18next.t("settings.hyperfocusToLinkedin")}</i>.</li>
        </Steps>

        <h3>{i18next.t("settings.stepBThePart")}</h3>
        <Steps>
          <li>{i18next.t("settings.click")} <b>{i18next.t("settings.addFirstStep")}</b>{i18next.t("settings.searchFor")} <b>{i18next.t("settings.webhook")}</b>{i18next.t("settings.andChooseIt")}</li>
          <li>{i18next.t("settings.set")} <b>{i18next.t("settings.httpMethod")}</b> {i18next.t("settings.to")} <b>{i18next.t("settings.post")}</b>{i18next.t("settings.leaveEverythingElseAs")}</li>
          <li>{i18next.t("settings.closeTheWebhookBox")}</li>
        </Steps>

        <h3>{i18next.t("settings.stepCThePart")}</h3>
        <Steps>
          <li>{i18next.t("settings.clickThe")} <b>+</b> {i18next.t("settings.onTheRightOf")} <b>{i18next.t("settings.linkedin")}</b>{i18next.t("settings.andChoose")} <b>{i18next.t("settings.createAPost")}</b>.</li>
          <li>
            {i18next.t("settings.nextTo")} <b>{i18next.t("settings.credentialToConnectWith")}</b>{i18next.t("settings.choose")} <b>{i18next.t("settings.createNewCredential")}</b>{i18next.t("settings.n8nAsksForA")} <b>{i18next.t("settings.clientId")}</b> {i18next.t("settings.and")} <b>{i18next.t("settings.clientSecret")}</b>{i18next.t("settings.useTheClientId")} <b>{i18next.t("settings.oauthRedirectUrl")}</b> {i18next.t("settings.insteadThenClick")} <b>{i18next.t("settings.connectMyAccount")}</b>{i18next.t("settings.signInToLinkedin")} <b>{i18next.t("settings.allow")}</b>.
          </li>
          <li>{i18next.t("settings.set")} <b>{i18next.t("settings.postAs")}</b> {i18next.t("settings.to")} <b>{i18next.t("settings.person")}</b>{i18next.t("settings.andIn")} <b>{i18next.t("settings.person")}</b> {i18next.t("settings.pickYourName")}</li>
          <li>
            {i18next.t("settings.clickInThe")} <b>{i18next.t("settings.text")}</b> {i18next.t("settings.boxSwitchItTo")} <b>{i18next.t("settings.expression")}</b> (the small toggle above it), and type exactly:{" "}
            <code>{"{{ $json.body.text }}"}</code> {i18next.t("settings.thisIsWhereHyperfocus")}
          </li>
          <li>{i18next.t("settings.closeTheLinkedinBox")}</li>
        </Steps>

        <h3>{i18next.t("settings.stepDSwitchIt")}</h3>
        <Steps>
          <li>{i18next.t("settings.click")} <b>{i18next.t("settings.save")}</b>{i18next.t("settings.thenSwitchTheWorkflow")} <b>{i18next.t("settings.inactiveActive")}</b> {i18next.t("settings.switchAtTheTop")} <b>{i18next.t("settings.publish")}</b>{i18next.t("settings.dependingOnYourN8n")}</li>
          <li>{i18next.t("settings.openThe")} <b>{i18next.t("settings.webhook")}</b> {i18next.t("settings.boxAgainClick")} <b>{i18next.t("settings.productionUrl")}</b> {i18next.t("settings.notTestUrlAnd")} <code>{i18next.t("settings.httpLocalhost5678Webhook")}</code>.</li>
          <li>
            {i18next.t("settings.inHyperfocus")} <Link to="/backup">{i18next.t("settings.settings")}</Link> → <b>{i18next.t("settings.yourConnections")}</b> → <b>{i18next.t("settings.linkedinThroughN8n")}</b>: paste it and click{" "}
            <b>{i18next.t("settings.save")}</b>.
          </li>
          <li>{i18next.t("settings.tryItWriteA")} <b>{i18next.t("settings.publish")}</b>{i18next.t("settings.itShouldAppearOn")}</li>
        </Steps>

        <details>
          <summary>{i18next.t("settings.publishingSaysN8nAnswered")}</summary>
          <ul>
            <li>{i18next.t("settings.checkTheWorkflowIs")} <b>{i18next.t("settings.on2")}</b> {i18next.t("settings.activePublishedAndThat")} <b>{i18next.t("settings.production")}</b> {i18next.t("settings.urlNotTheTest")}</li>
            <li>{i18next.t("settings.inN8nOpen")} <b>{i18next.t("settings.executions")}</b> {i18next.t("settings.leftSideEachAttempt")}</li>
            <li>{i18next.t("settings.linkedinConnectionsExpireAfter")} <b>{i18next.t("settings.reconnect")}</b>.</li>
          </ul>
        </details>
      </section>

      <p className="muted">
        {i18next.t("settings.stuckAnywayEverythingStill")}
      </p>
    </div>
  );
}
