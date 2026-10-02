// What each personality says when you tap your pet. The names, descriptions and XP perks come from the server.
export const VOICE: Record<string, string[]> = {
  curious: ["Ooh, what are we learning today?", "Wait, why does that work? Tell me!", "I have a question about everything.", "What if we tried a tiny experiment?"],
  nerdy: ["Fun fact: small steps compound. That's basically math.", "Did you know? Explaining it out loud makes it stick.", "Let's read the docs. Together. Yes!", "Technically, you're doing great."],
  nightowl: ["It's the brain's best hour... but sleep counts too.", "Midnight snacks and gentle focus, that's us.", "Okay, one more tiny thing, then rest.", "The quiet hours are my favorite."],
  playful: ["Yay yay yay! Tiny win!", "Do another one! Please? Pretty please?", "Zoomies because you did a thing!", "Bounce bounce bounce!"],
  hyper: ["YOU ARE ON FIRE!", "LET'S GOOO! Another one!", "I'm so proud I could burst!", "Nobody does it like you!"],
  focused: ["What's the next tiny step?", "One thing. Just the one.", "Let's make a little plan together.", "Small, clear, done. That's the way."],
  gentle: ["Take your time. I'm right here.", "Be kind to yourself today, okay?", "There's no rush. Soft steps count.", "You're doing enough. Really."],
  calm: ["Breathe in... and out. Nice.", "Slow is smooth. Smooth is steady.", "Shoulders down. Jaw soft. Good.", "Everything can wait a minute."],
  cheeky: ["Oh, look who's being productive!", "Brag about it. I dare you.", "Is that a finished task? Show-off.", "Not bad, human. Not bad at all."],
  brave: ["Hit publish. You're braver than you think.", "Scared and doing it anyway: that's courage.", "Share it. The world needs your voice.", "We don't wait for ready. We start."],
  rebel: ["Perfect? Nah. Posted? Yes.", "Rules are for overthinkers. Ship it!", "Messy draft energy, I love it.", "Break the perfectionism rule today."],
  sleepy: ["*yawn* ...that's a lovely page you read.", "Naps are productive. So are books.", "Five more minutes of reading... zzz.", "Cozy brain is happy brain."],
  wise: ["Look how far you've come.", "Every expert was once a beginner.", "Patience. The path is long and kind.", "You already know more than last week."],
  dreamer: ["Imagine where this goal takes you...", "Big dreams, tiny steps. That's the recipe.", "I can see it already. Can you?", "One day you'll look back at today and smile."],
};

// Used when nothing more specific applies
export const MOOD_VOICE: Record<string, string[]> = {
  egg: ["...", "It's warm in here. I can hear you working.", "Something is stirring. Keep going, I'm listening.", "Every finished thing makes me stronger."],
  happy: ["You did things today. I'm proud.", "Look at you go.", "Small steps. Big me.", "I felt that!"],
  content: ["Good to see you. One small thing today?", "Yesterday was a good day. Ready for another?", "I'm here whenever you are."],
  sleepy: ["I was resting. No rush at all.", "One tiny thing is enough. I'll be here.", "Missed you. We just start again.", "Rest is part of growing too."],
};
