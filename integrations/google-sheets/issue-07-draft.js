// ===========================================================================
// ISSUE 07 - STAGING DRAFT. DO NOT PASTE YET.
//
// Code.gs holds exactly ONE NEWSLETTER_ISSUE object. Paste this only after the
// previous issue has sent, or you overwrite an issue nobody ever receives.
// Issue 06 sent Sunday November 1. This one is dated Sunday November 8.
//
// ---------------------------------------------------------------------------
// DE-DUPLICATED 2026-11-02. The Sports block used to be the WNBA Game 7 /
// expansion-team story. Game 7 finished the night of Oct 31, in time to make
// Issue 06, which carries it as a full block WITH the Finals MVP line - so this
// issue was set to reprint it. The Sports block, the subject line ("a champion
// at last") and the intro's second sentence all pointed at it and have all been
// re-pointed. Do not put the WNBA back in here.
// ---------------------------------------------------------------------------
//
// MUSIC AND FASHION REPLACED 2026-11-02. Both were Oct 31 stories sitting in an
// issue that covers Nov 2-8, so both would have landed eight days old. Note the
// old Music fallback ("re-point it at the residency ending") was dead too: the
// MSG residency ENDED Oct 31, 30 shows from Aug 26, so the ending is also Issue
// 06's week. The draft also had the Harryween night wrong - Elvis was Oct 30,
// the Oct 31 finale was Pizza Rat. Do not put either back in.
//
// VERIFIED FOR THE NEW MUSIC BLOCK (2026-11-02, ABC News CMA nominees piece):
//   CMA Awards are Wed Nov 18 2026, Bridgestone Arena, Nashville, on ABC.
//   Lainey Wilson hosts AND is nominated for Entertainer of the Year.
//   Entertainer field: Combs, Cody Johnson, Langley, Stapleton, Wilson.
//   Langley: Album of the Year "Dandelion"; "Be Her" and "Choosin' Texas" in
//   both Single and Song. Swift: Single of the Year "I Knew It, I Knew You".
// Says Swift and Langley "share the lead in nominations" with NO count - the
// source names them as leaders but never prints a number. Do not add one.
// The block deliberately calls back to Issue 01 (Langley "racing herself up the
// chart") and Issue 06 (country holding the whole Hot 100 top five).
//
// VERIFIED FOR THE NEW FASHION BLOCK (2026-11-02, CFDA + WWD):
//   2026 CFDA Fashion Awards, Mon Nov 2, American Museum of Natural History.
//   Keke Palmer hosting. Pre-announced honours: Vaccarello (Saint Laurent)
//   International Designer, Tory Burch Positive Change, Peter Marino Fashion
//   Icon, van Lamsweerde + Matadin Geoffrey Beene Lifetime Achievement.
//
// FASHION BLOCK CLOSED OUT 2026-11-05. The ceremony went ahead Monday Nov 2 as
// scheduled, so the past tense is safe. The competitive winners are now public
// and the block leads with them instead of the honorary list:
//   Womenswear   Rachel Scott (Diotima) - her 2nd, after 2024
//   Menswear     Ralph Lauren - who won WOMENSWEAR in 2025
//   Accessory    Ana Khouri      Emerging  Colleen Allen
// Confirmed against the CFDA's own release (PR Newswire) AND The Impression.
// DATE TRAP: the PR Newswire release is datelined Nov 3 because it went out the
// next morning; the ceremony was the evening of Monday Nov 2. Keep "Monday".
// Diotima detail verified separately: Rachel Scott is Jamaican-born, the label's
// crochet is all made in Jamaica by artisans she treats as co-designers, and the
// signature starched-crochet look comes from traditional Jamaican doilies.
// Not used, to keep the block to the length of the others: Anthony Vaccarello
// (International Designer, his decade at Saint Laurent - cut because it is an
// INTERNATIONAL award in a block about American fashion), Gap Inc. (Innovation),
// Eva Chen (Media), Linda Fargo (Founder's), Susan Cianciolo (Isabel Toledo).
//
// Pop culture (Dune) is fine - the IMAX re-release starts Nov 13 and the finale
// is Dec 18, so it reads forward, not back. Anime is fine - productions in
// progress, no date to go stale.
//
// BLOCK COUNT: 5 blocks, which is the standard full set. Every issue ever sent
// has used these same five tags - Sports, Pop culture, Music, Anime, Fashion.
// There has never been a News block, and the news pillar's page is
// current-events.html, not news.html. Issue 06's 6th block was a second Sports,
// not a sixth pillar. A sixth here would mean doubling up a pillar, so this
// issue is complete at 5 - add one only if the week genuinely produces it.
//
// VERIFIED FOR THE NEW SPORTS BLOCK (2026-11-02, from the teams' own accounts):
//   @okcthunder - No. 0 retirement set for February 7, 2027.
//   @NBA - 11-year OKC career, 2016-17 MVP, 8x All-NBA, franchise leader in
//          PTS, REB, AST, STL, GP and MIN.
// Deliberately says NOTHING about whether he is currently on a roster - sources
// contradicted each other on that, so it is left out rather than guessed.
// ===========================================================================
const NEWSLETTER_ISSUE = {
  number: 7,
  dateline: 'Sunday, November 8, 2026',
  subject: 'The Week in Culture \u2014 a number going to the rafters, Dune\u2019s last chapter, and anime\u2019s move to the big screen',
  intro: 'A lot of long runs reached their final stretch this week. One of them is getting a banner, and one of them is finally getting an ending people spent decades calling unfilmable.',
  blocks: [
    {
      tag: 'Sports', page: 'sports.html', color: '#4fb3a9',
      head: 'Oklahoma City is putting Russell Westbrook\u2019s number in the rafters.',
      body: 'The Thunder set February 7 as the date for No. 0. Eleven seasons, the 2017 MVP, eight All-NBA teams \u2014 and he still leads the franchise in points, rebounds, assists, steals, games played and minutes. All six at once, years after he last wore the jersey. Players usually get honoured for winning. He is being honoured for carrying, which is a harder thing to fit on a banner, and it is most of why that number means what it does in that building.'
    },
    {
      tag: 'Pop culture', page: 'pop-culture.html', color: '#e3a34b',
      head: 'Dune is heading for its last chapter, and the first two go back to IMAX first.',
      body: 'The final trailer for Dune: Part Three landed this week, and it puts Chani at the centre of a story that no longer lines up with the book it came from. Before the finale arrives on December 18, Parts One and Two return to IMAX for one week starting November 13, with a sneak peek of Part Three attached. Three films to close out a story people spent decades calling unfilmable.'
    },
    {
      tag: 'Music', page: 'music.html', color: '#5aa0e8',
      head: 'Ella Langley is up for Entertainer of the Year, and the CMAs are ten days out.',
      body: 'We opened this newsletter in September with her racing herself up the chart. She goes to Nashville on November 18 sharing the lead in nominations with Taylor Swift, up for Entertainer of the Year against Luke Combs, Cody Johnson, Chris Stapleton and Lainey Wilson \u2014 who is also hosting. \u201CDandelion\u201D is up for Album of the Year, and both \u201CBe Her\u201D and \u201CChoosin\u2019 Texas\u201D are up for Single and Song. Last week country held the entire top five of the Hot 100. This is the room where that gets counted.'
    },
    {
      tag: 'Anime', page: 'anime.html', color: '#e0679a',
      head: 'Anime keeps buying tickets to the cinema.',
      body: 'Solo Leveling: Beyond the System is officially in production as a theatrical feature. The Rascal Does Not Dream series gets its conclusion in theatres for three nights in February. And Kojima Productions released a first trailer for Death Stranding Isolations, an anime series set inside the game\u2019s world. The jump from streaming to the big screen has stopped being a one-off.'
    },
    {
      tag: 'Fashion', page: 'fashion.html', color: '#b58cff',
      head: 'Diotima won American womenswear again, in a room full of dinosaurs.',
      body: 'The CFDA Awards were at the American Museum of Natural History on Monday, Keke Palmer hosting, and Rachel Scott took Womenswear Designer of the Year \u2014 her second in three years, for a label whose crochet is all made in Jamaica. Ralph Lauren took menswear, a year after winning womenswear, which is a strange sentence about a label that started in 1967. And lifetime achievement went to Inez van Lamsweerde and Vinoodh Matadin for thirty years of photographing this industry \u2014 the rarer kind of award, because fashion is much better at celebrating the people in front of the camera.'
    }
  ],
  live: 'Launch party incoming. The date and venue are almost locked, and this list hears first.',
  liveRsvp: 'You\u2019re on the launch party list. The date and venue are almost locked, and you\u2019ll hear first.',
  closer: 'What do you want more of? Hit reply. We read every one.'
};
