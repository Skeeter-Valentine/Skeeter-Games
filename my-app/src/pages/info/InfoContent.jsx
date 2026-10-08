import { CONTACT_EMAIL, LAUNCHED, PRIVACY_UPDATED, SITE_DOMAIN, SITE_NAME } from '../../siteInfo.js';

// Text for the About and Privacy pages. It is rendered by the SEO guide, so the
// same content is in the prerendered HTML that crawlers and ad reviewers read.

const external = { target: '_blank', rel: 'noreferrer' };

function Contact() {
  return CONTACT_EMAIL
    ? <>email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></>
    : <>use the feedback form at the bottom of any puzzle page (include an email address if you would like a reply)</>;
}

function About({ games }) {
  return <>
    <p>{SITE_NAME} is a free puzzle site with new logic, word and number puzzles every day. Everything runs in your browser: there is nothing to install and no account to create.</p>
    <h2>How it works</h2>
    <ul>
      <li><strong>A new daily puzzle for every game.</strong> Puzzles change at midnight UTC, and everyone gets the same puzzle on the same day.</li>
      <li><strong>Archives.</strong> Missed a day? Earlier daily puzzles stay playable from each game's archive.</li>
      <li><strong>Difficulty ratings.</strong> Each daily puzzle has a chili rating, and finished puzzles show how many players completed it and their average time.</li>
      <li><strong>Practice modes.</strong> Many games also offer unlimited practice puzzles at the difficulty you choose.</li>
      <li><strong>Accessibility.</strong> The word games include a colorblind mode, and many games support keyboard controls.</li>
    </ul>
    <h2>The games</h2>
    <ul>{games.map(game => <li key={game.path}><a href={game.path}>{game.name}</a> — {game.description}</li>)}</ul>
    <h2>Who makes it</h2>
    <p>{SITE_NAME} is built and run independently. It launched in {LAUNCHED}, and new games and features are added regularly. Several games are original twists on classic pencil-and-paper puzzles, such as those collected in <a href="https://www.chiark.greenend.org.uk/~sgtatham/puzzles/" {...external}>Simon Tatham's Portable Puzzle Collection</a>.</p>
    <h2>Get in touch</h2>
    <p>Ideas, bug reports and puzzle suggestions are always welcome. To reach us, <Contact />.</p>
  </>;
}

function Privacy() {
  return <>
    <p><em>Last updated: {PRIVACY_UPDATED}</em></p>
    <p>This policy explains what information {SITE_NAME} ({SITE_DOMAIN}) collects when you play, how it is used, and the choices you have. We keep data collection to what the site needs to run, count visits and show ads.</p>

    <h2>Information stored on your device</h2>
    <p>Your puzzle progress, statistics, streaks and settings (such as colorblind mode) are saved in your browser's local storage. They stay on your device and are not sent to us. Clearing your browser's site data removes them.</p>

    <h2>Anonymous puzzle results</h2>
    <p>When you play a daily or archive puzzle, the site records the game, the puzzle date, whether the puzzle was finished, given up or lost, and the solve time. Each result is linked to a random, anonymous ID created by Firebase Authentication (a Google service) so that each player counts once per puzzle. It is not linked to your name or email address. We use these results to show completion rates and average times, and to rate puzzle difficulty.</p>

    <h2>Feedback</h2>
    <p>If you send feedback, we receive your message, the page you sent it from and, if you provide one, your email address. Messages are delivered through EmailJS and used only to reply to you and improve the site.</p>

    <h2>Analytics</h2>
    <p>We use Google Analytics to understand how the site is used, for example which pages are visited, the type of device and browser, approximate location (country or city) and how visitors found the site. Google Analytics uses cookies and similar technologies. You can read <a href="https://policies.google.com/technologies/partner-sites" {...external}>how Google uses information from sites that use its services</a>, and you can opt out with the <a href="https://tools.google.com/dlpage/gaoptout" {...external}>Google Analytics opt-out browser add-on</a>.</p>

    <h2>Advertising</h2>
    <p>{SITE_NAME} is free because it is supported by ads. We work with third-party advertising partners, including Google AdSense, and may work with other ad networks in the future. These partners may use cookies, web beacons and similar technologies to show ads and measure how they perform.</p>
    <ul>
      <li>Third-party vendors, including Google, use cookies to serve ads based on your prior visits to this website or other websites.</li>
      <li>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visits to this site and/or other sites on the internet.</li>
      <li>You can opt out of personalized advertising from Google in <a href="https://myadcenter.google.com/" {...external}>My Ad Center</a>, and from many other vendors at <a href="https://optout.aboutads.info/" {...external}>aboutads.info</a> or, in Europe, <a href="https://www.youronlinechoices.eu/" {...external}>youronlinechoices.eu</a>.</li>
    </ul>
    <p>Learn more about <a href="https://policies.google.com/technologies/ads" {...external}>how Google uses cookies in advertising</a>.</p>

    <h2>Your choices and rights</h2>
    <ul>
      <li><strong>Europe, the UK and Switzerland:</strong> we ask for your consent before personalized ads and non-essential cookies are used. You can change your choice at any time with the “Privacy choices” link at the bottom of every page.</li>
      <li><strong>United States:</strong> some state privacy laws treat personalized advertising as a “sale” or “sharing” of personal information. You can opt out through the “Privacy choices” link when it is shown to you, through the opt-out links above, or by turning on Global Privacy Control in your browser.</li>
      <li><strong>Access or deletion:</strong> to ask about or delete information connected to feedback you sent, <Contact />. Puzzle results are anonymous and are only kept as part of overall totals.</li>
    </ul>

    <h2>Children</h2>
    <p>{SITE_NAME} is a general-audience site and is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe a child has sent us personal information, please contact us and we will delete it.</p>

    <h2>Changes to this policy</h2>
    <p>We may update this policy as the site changes, for example when we add a new advertising partner. The date at the top shows when it was last changed.</p>

    <h2>Contact</h2>
    <p>For privacy questions or requests, <Contact />.</p>
  </>;
}

export default function InfoContent({ id, games = [] }) {
  return id === 'privacy' ? <Privacy /> : id === 'about' ? <About games={games} /> : null;
}
