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
// STILL TO FIX BEFORE SENDING - two blocks belong to the WRONG WEEK.
// This issue covers Nov 2-8. These two are both Oct 31 stories, which is Issue
// 06's week, and will be eight days old by the time this lands:
//
//   * MUSIC  - Harryween / the X-Factor song. Night 29 of the MSG residency,
//              Oct 31. Replace with something from Nov 2-8, or re-point it at
//              the residency ending rather than that one night.
//   * FASHION - Halloween costumes as a style event. Oct 31. Same problem, and
//              harder to save: by Nov 8 nobody wants a Halloween round-up.
//              Replace it.
//
// Pop culture (Dune) is fine - the IMAX re-release starts Nov 13 and the finale
// is Dec 18, so it reads forward, not back. Anime is fine - productions in
// progress, no date to go stale.
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
