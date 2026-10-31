export const webinarPhase = "CASE WHEN w.status IN('completed','cancelled') OR w.ending_time<now() THEN 'previous' WHEN w.starting_time>now() THEN 'upcoming' ELSE 'ongoing' END";
