/**
 * SAMARPAN — CMS Login Handler (GitHub OAuth for Decap CMS)
 * -----------------------------------------------------------
 * This is a small, separate Cloudflare Worker (NOT part of your
 * main website). It only exists so that when a contributor clicks
 * "Login with GitHub" on thesamarpan.co.in/admin, GitHub can safely
 * verify who they are.
 *
 * Deploy this once. You will not need to touch it again.
 * Setup steps are in SETUP_INSTRUCTIONS.md
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/auth') {
      const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${env.GITHUB_CLIENT_ID}&scope=repo,user`;
      return Response.redirect(githubAuthUrl, 302);
    }

    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');
      if (!code) return new Response('Missing code', { status: 400 });

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: env.GITHUB_CLIENT_ID,
          client_secret: env.GITHUB_CLIENT_SECRET,
          code
        })
      });
      const tokenData = await tokenRes.json();

      if (tokenData.error) {
        return new Response(`OAuth error: ${tokenData.error_description || tokenData.error}`, { status: 400 });
      }

      const token = tokenData.access_token;
      const payload = JSON.stringify({ token, provider: 'github' });
      const script = `
        <script>
          (function() {
            function receiveMessage(e) {
              window.opener.postMessage(
                'authorization:github:success:${payload}',
                e.origin
              );
              window.removeEventListener("message", receiveMessage, false);
            }
            window.addEventListener("message", receiveMessage, false);
            window.opener.postMessage("authorizing:github", "*");
          })();
        </script>
      `;
      return new Response(script, { headers: { 'Content-Type': 'text/html' } });
    }

    return new Response('Samarpan CMS auth worker is running.', { status: 200 });
  }
};
