// ===========================================================================
// ISSUE 10 - STAGING DRAFT for Sunday, November 29, 2026 (Thanksgiving weekend).
//
// Code.gs holds exactly ONE NEWSLETTER_ISSUE. Paste this over it only AFTER the
// issue before it has sent. It refers back to Issue 09 ("We wrote last week…",
// the anime block), so if Issue 09 never went out, cut that sentence.
//
// Before sending Sunday: the box-office block uses Wednesday opening-day
// numbers and the five-day projections. If the studios' Sunday estimates are
// out, swap in the five-day totals from two sources.
// ---------------------------------------------------------------------------
// VERIFIED (Nov 27, 2026, search checks):
// Sports: Bears 39, Lions 35, Thanksgiving at Ford Field. Detroit led by 11 late;
//   Williams to Odunze for the winning TD from 6 yards with 3 seconds left after
//   a 13-play drive in the final 2:14; Gibbs 3 rushing TDs; Bears 9-2, alone in
//   first in the NFC North. (NFL.com, Yahoo Sports x2, Fox 32, DAZN,
//   ClickOnDetroit, Bleacher Nation). Left out: the first Odunze TD's length
//   (40 vs 41 yds) and Williams' stat line (one source).
// Pop culture: Wed Nov 25 opening day: Hexed (Disney) $7.6M from 3,725
//   theaters, A- CinemaScore; Focker In-Law (Universal) $5.3M from 3,382;
//   both projected ~$35-36M over five days, under $40-45M forecasts. Sunrise on
//   the Reaping led Wednesday with $15.1M. Hexed is Walt Disney Animation's 65th
//   feature and an original. (Variety, Deadline via news-usa/inbella,
//   Boxoffice Pro)
// Music: Hot 100 dated Nov 28: "Choosin' Texas" 29th week at No. 1; "Last
//   Christmas" into the top five; "Jingle Bell Rock" at No. 9. (Billboard's own
//   Top 10 countdown video, the chart's primary source; Spectrum Pulse
//   breakdown for the holiday songs). "Choosin' Texas" passed "All I Want for
//   Christmas Is You" for most weeks at No. 1 (Billboard, Axios, CTV, KATU).
// Anime: Witch on the Holy Night sequel confirmed by a post-credits scene and
//   the official account; no date. US/Canada first film Jan 29, 2027.
//   (Crunchyroll News Nov 24, Final Weapon Nov 19; dates verified for Issue 09)
// Fashion: The Fashion Awards, Mon Nov 30, Royal Albert Hall, London; Ncuti
//   Gatwa hosts; a fundraiser for the BFC Foundation. (British Fashion Council
//   x2, Style Rave, litme). Martine Rose at Balenciaga verified for Issue 08.
//   Left out: the nominee list (only partly visible, one listing).
// ===========================================================================
const NEWSLETTER_ISSUE = {
  number: 10,
  dateline: 'Sunday, November 29, 2026',
  subject: 'The Week in Culture — the Bears steal Thanksgiving, Christmas hits the charts, and a sequel for Witch on the Holy Night',
  intro: 'Happy Thanksgiving weekend. A comeback in Detroit, two new movies at the holiday box office, and the Christmas songs are back on the chart, right on schedule.',
  blocks: [
    {
      tag: 'Sports', page: 'sports.html', color: '#4fb3a9',
      head: 'The Bears stole Thanksgiving in Detroit.',
      body: 'Down 11 in the fourth quarter at Ford Field, Chicago came back to win 39-35. Caleb Williams hit Rome Odunze for a long touchdown to get close, then drove 13 plays in the final 2:14 and found Odunze again from six yards out with three seconds left. Jahmyr Gibbs ran for three touchdowns and still lost. The Bears are 9-2 and alone in first in the NFC North, and they took it from the team that was chasing them.'
    },
    {
      tag: 'Pop culture', page: 'pop-culture.html', color: '#e3a34b',
      head: 'Two new families moved into the holiday box office.',
      body: 'Disney’s Hexed, Walt Disney Animation’s 65th feature and an original story, made $7.6 million on Wednesday’s opening day and earned an A- CinemaScore. Universal’s Focker In-Law made $5.3 million. Both were tracking for about $35 million over the five-day holiday, a little under forecasts. The Hunger Games: Sunrise on the Reaping, in its second week, still led Wednesday with $15.1 million.'
    },
    {
      tag: 'Music', page: 'music.html', color: '#5aa0e8',
      head: 'Christmas is back on the Hot 100, and it still can’t move “Choosin’ Texas”.',
      body: 'On the chart dated November 28, Wham!’s “Last Christmas” climbed into the top five and “Jingle Bell Rock” landed at No. 9, right on schedule. Ella Langley’s “Choosin’ Texas” stayed at No. 1 for a 29th week. The song it took the all-time record from, Mariah Carey’s “All I Want for Christmas Is You”, usually climbs all through December. The rematch is coming.'
    },
    {
      tag: 'Anime', page: 'anime.html', color: '#e0679a',
      head: 'Witch on the Holy Night is getting a sequel.',
      body: 'Days after the film opened in Japan, a post-credits scene confirmed a second one, and the official account has since said it is in production. There is no date yet. We wrote last week that this was a fan-favourite studio adapting a fan-favourite story; ufotable and TYPE-MOON are clearly not stopping at one. North America still gets the first film on January 29.'
    },
    {
      tag: 'Fashion', page: 'fashion.html', color: '#b58cff',
      head: 'The Fashion Awards are Monday in London.',
      body: 'The British Fashion Council’s Fashion Awards take over the Royal Albert Hall on Monday, November 30, with Ncuti Gatwa hosting. The night doubles as the big fundraiser for the BFC Foundation, which backs young British designers. It lands at the end of an autumn of designer moves, Martine Rose’s arrival at Balenciaga among them, so expect the speeches to be about what comes next. The winners land after this does.'
    }
  ],
  live: 'Launch party incoming. The date and venue are almost locked, and this list hears first.',
  liveRsvp: 'You’re on the launch party list. The date and venue are almost locked, and you’ll hear first.',
  closer: 'What do you want more of? Hit reply. We read every one.'
};
