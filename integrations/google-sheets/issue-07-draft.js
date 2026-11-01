// ===========================================================================
// ISSUE 07 - STAGING DRAFT. DO NOT PASTE YET.
//
// Code.gs holds exactly ONE NEWSLETTER_ISSUE object. Issue 06 is in there now
// and sends Sunday November 1. Pasting this before that send would overwrite
// Issue 06 and nobody would ever receive it.
//
// Paste this ONLY after Issue 06 has gone out.
//
// SPORTS BLOCK IS FILLED (Game 7 final: Golden State 68, Atlanta 63).
//
// HEADS UP - OVERLAP WITH ISSUE 06. Game 7 finished the night of Oct 31, in
// time to make Issue 06, so Issue 06 now carries it as a second Sports block.
// This block keeps the story but takes the expansion-team angle instead of the
// first-Game-7 angle, so the two do not read as a reprint. Even so, by Nov 8
// this is week-old news: before pasting, consider re-pointing BOTH this block
// and the subject line ("a champion at last") at something from that week.
// ===========================================================================
const NEWSLETTER_ISSUE = {
  number: 7,
  dateline: 'Sunday, November 8, 2026',
  subject: 'The Week in Culture \u2014 a champion at last, Dune\u2019s last chapter, and a night everyone dressed as someone else',
  intro: 'A lot of long runs reached their final stretch this week. One of them ended in a game that had never been played before.',
  blocks: [
    {
      tag: 'Sports', page: 'sports.html', color: '#4fb3a9',
      head: 'An expansion team won a championship in its second season.',
      body: 'Golden State closed Atlanta out 68-63 in the first Game 7 the WNBA Finals has ever needed. The franchise played its first game in May 2025, became the first expansion team to reach the playoffs in its debut season, and won the title the year after that. Gabby Williams scored 30 in the decider. Atlanta has been in the league since 2008 and has now been to four Finals without winning any of them. Expansion teams are normally handed a decade of patience and a rebuilding plan. This one declined both.'
    },
    {
      tag: 'Pop culture', page: 'pop-culture.html', color: '#e3a34b',
      head: 'Dune is heading for its last chapter, and the first two go back to IMAX first.',
      body: 'The final trailer for Dune: Part Three landed this week, and it puts Chani at the centre of a story that no longer lines up with the book it came from. Before the finale arrives on December 18, Parts One and Two return to IMAX for one week starting November 13, with a sneak peek of Part Three attached. Three films to close out a story people spent decades calling unfilmable.'
    },
    {
      tag: 'Music', page: 'music.html', color: '#5aa0e8',
      head: 'Harry Styles covered his own X-Factor audition song, sixteen years later.',
      body: 'At Harryween, night 29 of his Madison Square Garden residency, he opened the show dressed as Elvis and somewhere in the night sang Stevie Wonder\u2019s \u201CIsn\u2019t She Lovely\u201D \u2014 the song he auditioned with on the X-Factor in 2010, at sixteen. A residency is usually where a career goes to settle down. He has turned his into the main event instead.'
    },
    {
      tag: 'Anime', page: 'anime.html', color: '#e0679a',
      head: 'Anime keeps buying tickets to the cinema.',
      body: 'Solo Leveling: Beyond the System is officially in production as a theatrical feature. The Rascal Does Not Dream series gets its conclusion in theatres for three nights in February. And Kojima Productions released a first trailer for Death Stranding Isolations, an anime series set inside the game\u2019s world. The jump from streaming to the big screen has stopped being a one-off.'
    },
    {
      tag: 'Fashion', page: 'fashion.html', color: '#b58cff',
      head: 'Halloween is the only night of the year that is genuinely a style event.',
      body: 'Karol G went out as the Corpse Bride. Zendaya built her look as an homage to Halle Berry\u2019s X-Men premiere, and Halle Berry publicly approved. Harry Styles opened his own show as Elvis. No brief, no buyers, no runway \u2014 just people deciding who they wanted to be for one night, and everyone else reading the choice. It is the closest thing fashion has to an open submission.'
    }
  ],
  live: 'Launch party incoming. The date and venue are almost locked, and this list hears first.',
  liveRsvp: 'You\u2019re on the launch party list. The date and venue are almost locked, and you\u2019ll hear first.',
  closer: 'What do you want more of? Hit reply. We read every one.'
};
