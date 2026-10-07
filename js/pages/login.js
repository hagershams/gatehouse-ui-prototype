/* Sign-in: one form for staff and residents. */
(function () {
  "use strict";
  const { api, ui } = window.GH;
  const { html, icon } = ui;

  window.GH.pages.login = function (root) {
    const mock = api.mode === "mock";
    root.innerHTML = String(html`
      <div class="login">
        <section class="login-art" aria-hidden="true">
          <div class="row" style="gap:12px">
            <div class="brand-mark">${ui.raw('<svg viewBox="0 0 24 24" width="20" height="20"><rect x="3" y="9" width="4" height="12" rx="1" fill="#fff"/><path d="M7 12h14" stroke="#f2b33d" stroke-width="3" stroke-linecap="round"/><path d="M3 21h18" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>')}</div>
            <div><div class="brand-name" style="color:#fff">Gatehouse</div><div class="brand-sub" style="color:#8fa89e">Access control</div></div>
          </div>
          <div>
            <h1>Every gate, every plate, every visitor — in one place.</h1>
            <p>Monitor gate status live, see who is coming and going, and manage residents, vehicles and visitor passes for the whole compound.</p>
            <div class="lane"><div class="lane-road"></div><div class="lane-post"></div><div class="lane-arm"></div></div>
          </div>
          <div class="login-stats"><span><b>6</b>gates</span><span><b>LPR + QR</b>access</span><span><b>24/7</b>event log</span></div>
        </section>
        <section class="login-form">
          <div style="max-width:380px;width:100%;margin:0 auto">
            <h2>Sign in</h2>
            <p class="muted" style="margin-bottom:24px">Staff and residents use the same sign-in.</p>
            <form class="form" novalidate>
              ${ui.field("email", "Email", ui.input("email", "", 'type="email" autocomplete="username" required'), { required: true })}
              ${ui.field("password", "Password", ui.input("password", "", 'type="password" autocomplete="current-password" required'), { required: true })}
              <button class="btn primary" type="submit" style="min-height:42px">Sign in</button>
            </form>
            ${mock ? html`<div class="demo">
              <div style="font-weight:600;margin-bottom:6px">Prototype demo accounts</div>
              <p class="muted xs" style="margin-bottom:6px">Each opens the app with that role's permissions. Password: <span class="mono">demo1234</span></p>
              ${window.GH.DEMO.map((d) => html`<button type="button" data-demo="${d.email}">${icon(d.resident ? "home" : "shield")}${d.label}</button>`)}
              <button type="button" data-demo="hany.morsy@gate-system.com">${icon("lock")}Blocked officer · Hany Morsy</button>
              <p class="xs" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--line)">New here? <a href="docs/user-guide.html" target="_blank" rel="noopener" data-guide>Read the demo guide</a> · <a href="docs/demo-checklist.html" target="_blank" rel="noopener">Review checklist</a></p>
            </div>` : ""}
          </div>
        </section>
      </div>`);

    const form = root.querySelector("form");
    const submit = async (email, password) => {
      const btn = form.querySelector("button[type=submit]");
      ui.showErrors(form, {});
      const errs = {};
      if (!email) errs.email = "Enter your email.";
      else if (!/^\S+@\S+\.\S+$/.test(email)) errs.email = "Enter a valid email address.";
      if (!password) errs.password = "Enter your password.";
      if (Object.keys(errs).length) return ui.showErrors(form, errs);
      try {
        await ui.busy(btn, () => window.GH.signIn(email, password));
        location.hash = window.GH.homeFor(window.GH.auth.session());
      } catch (err) {
        const msg = err.status === 401 ? "That email and password don't match an account."
          : err.status === 403 ? (err.detail === "User not allowed" ? "Your resident access is suspended. Contact the management office." : "This account is blocked or inactive. Ask an administrator to restore it.")
          : ui.errorMessage(err);
        ui.showErrors(form, {}, msg);
      }
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = ui.formValues(form);
      submit(v.email, v.password);
    });
    root.querySelectorAll("[data-demo]").forEach((b) => (b.onclick = () => {
      form.email.value = b.dataset.demo;
      form.password.value = "demo1234";
      submit(b.dataset.demo, "demo1234");
    }));
    setTimeout(() => form.email.focus(), 30);
  };
})();
