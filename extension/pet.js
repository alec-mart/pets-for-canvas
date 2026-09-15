// The pet that lives on the Canvas page: a species-blind engine (attention, scheduler, moods,
// one-shots, leash, treats) driving any rig that implements the .cd-* class contract.

(() => {
  const log = (...a) => console.log("[canvas-digest:pet]", ...a);
  const SIZE = 108;
  // One entry per line in this exact shape: popup.js and the motion bench parse this table out of the source.
  // transform mounts the art in the 100x100 engine box; scale divides gaze px; ready=false falls back to the pup.
  const SPECIES = {
    pup: { art: "art/winston-rig.svg", transform: "translate(-4.25,-4.2) scale(0.1088)", scale: 0.1088, idles: "sit,stretch,yawn,look,tailchase,earflick,sniff,wagburst,shake", ready: true },
    cat: { art: "art/cat-rig.svg", transform: "translate(-4.9,-3.6) scale(0.1066)", scale: 0.1066, idles: "sit,stretch,yawn,look,tailchase,earflick,shake", ready: true },
    capy: { art: "art/capy-rig.svg", transform: "translate(100.7,13.4) scale(-0.098,0.098)", scale: 0.098, idles: "sit,stretch,yawn,look,earflick,snack", ready: true },
  };
  const speciesFor = (key) => {
    const s = key === "pup" || !key ? "pup" : String(key).replace(/^animal_/, "");
    return SPECIES[s]?.ready ? s : "pup";
  };
  let species = "pup";
  const AFK_MS = 150000;
  const FLOOR = 0;

  // ---- rig ----

  function buildRig() {
    const wrap = document.createElement("div");
    wrap.id = "cd-pet";
    wrap.dataset.mood = "content";
    wrap.dataset.idles = "sit,stretch,yawn,look,tailchase,earflick,sniff,wagburst,shake";
    wrap.style.cssText = `
      position: fixed; bottom: 0; left: 0; width: ${SIZE}px; height: ${SIZE}px;
      z-index: 2147483646; cursor: grab; user-select: none;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.18));
      opacity: 0; transition: opacity .45s ease;
      will-change: transform;
    `;
    wrap.innerHTML = `
      <style>
        @keyframes cd-breathe { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.978) translateY(.7px) } }
        @keyframes cd-breathe-slow { 0%,100% { transform: scaleY(1) } 50% { transform: scaleY(.986) translateY(.5px) } }
        /* the gait: double-bounce per cycle, rise on push-off, squash on contact */
        @keyframes cd-gait {
          0%,100% { transform: translateY(0) rotate(-2.5deg) scaleY(1) }
          12% { transform: translateY(-3px) rotate(-1deg) scaleY(1.01) }
          25% { transform: translateY(-.5px) rotate(0deg) scaleY(.985) }
          38% { transform: translateY(-3px) rotate(1deg) scaleY(1.01) }
          50% { transform: translateY(0) rotate(2.5deg) scaleY(1) }
          62% { transform: translateY(-3px) rotate(1deg) scaleY(1.01) }
          75% { transform: translateY(-.5px) rotate(0) scaleY(.985) }
          88% { transform: translateY(-3px) rotate(-1deg) scaleY(1.01) }
        }
        /* secondary motion: ears and tail lag the body via animation-delay */
        @keyframes cd-ear-flop { 0%,100% { transform: rotate(-6deg) } 50% { transform: rotate(7deg) } }
        @keyframes cd-ear-flop-sadl { 0%,100% { transform: rotate(-18deg) } 50% { transform: rotate(-9deg) } }
        @keyframes cd-ear-flop-sadr { 0%,100% { transform: rotate(18deg) } 50% { transform: rotate(9deg) } }
        @keyframes cd-tail-fast { 0%,100% { transform: rotate(-10deg) } 50% { transform: rotate(18deg) } }
        @keyframes cd-ear-air { 0% { transform: rotate(0) } 30% { transform: rotate(9deg) } 60% { transform: rotate(-11deg) } 100% { transform: rotate(0) } }
        @keyframes cd-tail    { 0%,100% { transform: rotate(-8deg) } 50% { transform: rotate(14deg) } }
        @keyframes cd-tail-low{ 0%,100% { transform: rotate(-2deg) } 50% { transform: rotate(3deg) } }
        @keyframes cd-jump {
          0% { transform: translateY(0) scale(1,1) } 18% { transform: translateY(2px) scale(1.08,.9) }
          45% { transform: translateY(-34px) scale(.92,1.1) } 70% { transform: translateY(0) scale(1.06,.9) }
          85% { transform: translateY(-8px) scale(.98,1.03) } 100% { transform: translateY(0) scale(1,1) }
        }
        @keyframes cd-eat-bob {
          0%,100% { transform: rotate(0) translateY(0) }
          12%,44%,76% { transform: rotate(3.5deg) translateY(3.5px) scaleY(.955) }
          28%,60%,90% { transform: rotate(1.2deg) translateY(1px) }
        }
        @keyframes cd-chomp { 0%,100% { transform: scaleY(1) } 30%,70% { transform: scaleY(.945) translateY(1.4px) } 50% { transform: scaleY(1.012) } }
        @keyframes cd-spin-jump {
          0% { transform: translateY(0) rotate(0) scale(1,1) } 15% { transform: translateY(3px) scale(1.1,.87) }
          55% { transform: translateY(-44px) rotate(360deg) scale(.95,1.05) }
          80% { transform: translateY(0) rotate(360deg) scale(1.07,.93) } 100% { transform: translateY(0) rotate(360deg) scale(1,1) }
        }
        @keyframes cd-poke {
          0%,100% { transform: rotate(0) translateX(0) }
          25% { transform: rotate(-10deg) translateX(-3px) }
          40% { transform: rotate(6deg) translateX(6px) scaleY(.965) }
          55% { transform: rotate(-4deg) translateX(-2px) }
          70% { transform: rotate(6deg) translateX(6px) scaleY(.965) }
        }
        @keyframes cd-zzz-float { 0% { opacity: 0; transform: translate(0,0) } 30% { opacity: .8 } 100% { opacity: 0; transform: translate(10px,-26px) } }
        @keyframes cd-gait-scurry {
          0%,100% { transform: translateY(0) rotate(-.8deg) }
          25% { transform: translateY(-1.6px) rotate(0) scaleY(1.006) }
          50% { transform: translateY(0) rotate(.8deg) }
          75% { transform: translateY(-1.6px) rotate(0) scaleY(1.006) }
        }
        @keyframes cd-rumble { 0%,100% { transform: translateX(0) } 25% { transform: translateX(-.8px) } 75% { transform: translateX(.8px) } }
        /* idles */
        /* sit lands with follow-through: overshoot down, settle up */
        @keyframes cd-sit { 0% { transform: scaleY(1) } 14% { transform: scaleY(.88) translateY(3.8px) } 26% { transform: scaleY(.915) translateY(2.6px) } 90% { transform: scaleY(.9) translateY(3px) } 100% { transform: scaleY(1) } }
        /* stretch with anticipation: crouch first, then the big extend, then overshoot back */
        @keyframes cd-stretch {
          0% { transform: scale(1,1) }
          18% { transform: scale(.97,.955) translateY(1.4px) }
          45% { transform: scale(1.13,.89) translateY(3px) rotate(-2deg) }
          70% { transform: scale(.95,1.08) translateY(-2px) }
          82% { transform: scale(1.03,.97) }
          100% { transform: scale(1,1) }
        }
        @keyframes cd-yawn-body { 0%,100% { transform: scaleY(1) } 30% { transform: scaleY(1.07) translateY(-1.5px) rotate(-1.5deg) } 65% { transform: scaleY(1.04) translateY(-1px) } }
        @keyframes cd-earflick { 0%,100% { transform: rotate(0) } 20% { transform: rotate(14deg) } 35% { transform: rotate(-4deg) } 50% { transform: rotate(8deg) } 65% { transform: rotate(0) } }
        @keyframes cd-sniff {
          0%,100% { transform: rotate(0) translateY(0) }
          18% { transform: rotate(7deg) translateY(2.5px) }
          28% { transform: rotate(7deg) translateY(4px) } 38% { transform: rotate(7deg) translateY(2.5px) }
          48% { transform: rotate(8deg) translateY(4px) } 58% { transform: rotate(7deg) translateY(2.5px) }
          72% { transform: rotate(8deg) translateY(4px) }
        }
        @keyframes cd-wag-body { 0%,100% { transform: rotate(-1.5deg) } 50% { transform: rotate(1.5deg) } }
        @keyframes cd-shake { 0%,100% { transform: rotate(0) } 15% { transform: rotate(-7deg) } 30% { transform: rotate(7deg) } 45% { transform: rotate(-5deg) } 60% { transform: rotate(4deg) } 75% { transform: rotate(-2deg) } 88% { transform: rotate(1deg) } }
        @keyframes cd-look { 0%,100% { transform: rotate(0) } 25% { transform: rotate(-6deg) } 65% { transform: rotate(7deg) } }
        @keyframes cd-liedown { 0% { transform: scaleY(1) } 25%,85% { transform: scaleY(.62) translateY(10px) scaleX(1.18) } 100% { transform: scaleY(1) } }
        @keyframes cd-tailchase { 0% { transform: rotate(0) } 18% { transform: rotate(15deg) } 40% { transform: rotate(-11deg) } 60% { transform: rotate(8deg) } 80% { transform: rotate(-4deg) } 100% { transform: rotate(0) } }
        @keyframes cd-tailchase-rev { 0% { transform: rotate(0) } 18% { transform: rotate(-15deg) } 40% { transform: rotate(11deg) } 60% { transform: rotate(-8deg) } 80% { transform: rotate(4deg) } 100% { transform: rotate(0) } }
        @keyframes cd-rest {
          0%,100% { transform: scaleY(1) }
          50% { transform: scaleY(.972) translateY(1px) }
        }
        @keyframes cd-plant { 0% { transform: scaleY(1) } 100% { transform: scaleY(.952) translateY(1.6px) rotate(-2deg) } }
        @keyframes cd-mote-float {
          0% { opacity: 0; transform: translate(0, 0) scale(.35) }
          14% { opacity: .95 }
          100% { opacity: 0; transform: translate(var(--mx, 0px), -54px) scale(1) }
        }
        @keyframes cd-emote-pop {
          0% { transform: translateY(6px) scale(.3); opacity: 0 }
          18% { transform: translateY(0) scale(1.12); opacity: 1 }
          30% { transform: translateY(-2px) scale(1); opacity: 1 }
          80% { transform: translateY(-14px) scale(1); opacity: 1 }
          100% { transform: translateY(-24px) scale(.9); opacity: 0 }
        }

        #cd-pet svg { overflow: visible; } /* jumps must not decapitate */
        #cd-pet .cd-pose-sleep { display: none; transform: scale(1.4); transform-origin: 50% 100%; }
        #cd-pet.cd-resting .cd-pose-awake { display: none; }
        #cd-pet.cd-resting .cd-pose-sleep { display: block; }
        #cd-pet.cd-resting .cd-zzz { opacity: 1; transform: translate(-44px, 34px); }
        #cd-pet.cd-resting .cd-zzz text { animation: cd-zzz-float 2.6s ease-out infinite; }
        #cd-pet.cd-resting .cd-zzz text:nth-child(2) { animation-delay: 1.3s; }
        #cd-pet .cd-jump-rig { transform-origin: 50% 100%; }
        #cd-pet .cd-body-rig { animation: cd-breathe 3.2s ease-in-out infinite; transform-origin: 50% 100%; }
        #cd-pet .cd-tail { animation: cd-tail 2.4s ease-in-out infinite; transform-origin: 32% 75%; }
        #cd-pet .cd-ear-l { transition: transform .6s ease; transform-origin: 31% 18%; }
        #cd-pet .cd-ear-r { transition: transform .6s ease; transform-origin: 69% 18%; }
        #cd-pet .cd-mouth-sad, #cd-pet .cd-mouth-open, #cd-pet .cd-zzz { opacity: 0; }

        #cd-pet.cd-walking .cd-body-rig { animation: cd-gait var(--cd-gait-dur, .6s) linear infinite; }
        #cd-pet.cd-walking .cd-ear-l { animation: cd-ear-flop var(--cd-gait-dur, .6s) ease-in-out .06s infinite; }
        #cd-pet.cd-walking .cd-ear-r { animation: cd-ear-flop var(--cd-gait-dur, .6s) ease-in-out .12s infinite; }
        #cd-pet.cd-walking .cd-tail { animation: cd-tail-fast var(--cd-gait-dur, .6s) ease-in-out .09s infinite; }
        #cd-pet.cd-scurry .cd-body-rig { animation: cd-gait-scurry .34s linear infinite; }
        #cd-pet.cd-scurry .cd-ear-l { animation: cd-ear-flop .34s ease-in-out .04s infinite; }
        #cd-pet.cd-scurry .cd-ear-r { animation: cd-ear-flop .34s ease-in-out .08s infinite; }
        #cd-pet.cd-scurry .cd-tail { animation: cd-tail-fast .34s ease-in-out .05s infinite; }
        #cd-pet[data-mood="sad"].cd-walking .cd-ear-l { animation: cd-ear-flop-sadl .9s ease-in-out infinite; }
        #cd-pet[data-mood="sad"].cd-walking .cd-ear-r { animation: cd-ear-flop-sadr .9s ease-in-out .08s infinite; }
        #cd-pet.cd-jumping .cd-ear-l { animation: cd-ear-air .9s ease-out; }
        #cd-pet.cd-jumping .cd-ear-r { animation: cd-ear-air .9s ease-out .05s; }
        #cd-pet.cd-jumping .cd-jump-rig { animation: cd-jump .9s cubic-bezier(.34,1.4,.5,1) 1; }
        #cd-pet.cd-eating .cd-body-rig { animation: cd-eat-bob 1.2s ease-in-out 1; }
        #cd-pet.cd-ultra .cd-jump-rig { animation: cd-spin-jump 1.15s cubic-bezier(.34,1.3,.5,1) 2; }
        #cd-pet.cd-poking .cd-body-rig { animation: cd-poke 1.3s ease-in-out 1; }
        #cd-pet.cd-idle-sit .cd-body-rig { animation: cd-sit 5s ease-in-out 1; }
        #cd-pet.cd-idle-stretch .cd-body-rig { animation: cd-stretch 2.2s ease-in-out 1; }
        #cd-pet.cd-idle-yawn .cd-body-rig { animation: cd-yawn-body 2.4s ease-in-out 1; }
        #cd-pet.cd-idle-look .cd-body-rig { animation: cd-look 3.4s ease-in-out 1; }
        #cd-pet.cd-idle-liedown .cd-body-rig { animation: cd-liedown 8s ease-in-out 1; }
        #cd-pet.cd-idle-tailchase .cd-jump-rig { animation: cd-tailchase 1.4s ease-in-out 2; transform-origin: 50% 88%; }
        #cd-pet.cd-idle-tailchase .cd-tail { animation: cd-tail-fast .3s ease-in-out 9; }
        #cd-pet.cd-idle-tailchase.cd-tc-rev .cd-jump-rig { animation-name: cd-tailchase-rev; }
        #cd-pet.cd-idle-earflick .cd-ear-r { animation: cd-earflick 1.2s ease-in-out 1; }
        #cd-pet.cd-idle-sniff .cd-body-rig { animation: cd-sniff 2.3s ease-in-out 1; }
        #cd-pet.cd-idle-wagburst .cd-tail { animation: cd-tail-fast .28s ease-in-out 6; }
        #cd-pet.cd-idle-wagburst .cd-body-rig { animation: cd-wag-body .28s ease-in-out 6; }
        #cd-pet.cd-idle-shake .cd-body-rig { animation: cd-shake 1.4s cubic-bezier(.36,.07,.19,.97) 1; }
        #cd-pet.cd-idle-yawn .cd-ear-l { transform: rotate(-12deg); }
        #cd-pet.cd-idle-yawn .cd-ear-r { transform: rotate(12deg); }
        @keyframes cd-shadow-dip { 0%,100% { transform: scaleX(1); opacity: 1 } 45% { transform: scaleX(.6); opacity: .45 } }
        #cd-pet .cd-shadow { transform-origin: 50% 95%; }
        #cd-pet.cd-jumping .cd-shadow { animation: cd-shadow-dip .9s cubic-bezier(.34,1.4,.5,1) 1; }
        #cd-pet.cd-ultra .cd-shadow { animation: cd-shadow-dip 1.15s cubic-bezier(.34,1.3,.5,1) 2; }
        #cd-pet.cd-resting .cd-body-rig { animation: cd-rest 4.6s ease-in-out infinite; }
        #cd-pet.cd-resting .cd-lids { opacity: 1; }
        #cd-pet.cd-resting .cd-tail { animation: cd-tail-low 4.5s ease-in-out infinite; }
        #cd-pet.cd-stubborn .cd-body-rig { animation: cd-plant .35s ease-out forwards; }
        #cd-pet.cd-stubborn .cd-ear-l { transform: rotate(-16deg); }
        #cd-pet.cd-stubborn .cd-ear-r { transform: rotate(16deg); }

        /* moods */
        #cd-pet[data-mood="sad"] .cd-ear-l { transform: rotate(-13deg); }
        #cd-pet[data-mood="sad"] .cd-ear-r { transform: rotate(13deg); }
        #cd-pet[data-mood="sad"] .cd-tail { animation: cd-tail-low 3.6s ease-in-out infinite; }
        #cd-pet[data-mood="sad"] .cd-body-rig { animation: cd-breathe-slow 4.2s ease-in-out infinite; }
        #cd-pet[data-mood="hungry"] .cd-ear-l { transform: rotate(-7deg); }
        #cd-pet[data-mood="hungry"] .cd-ear-r { transform: rotate(7deg); }
        #cd-pet[data-mood="hungry"] .cd-body-rig { animation: cd-breathe 3.2s ease-in-out infinite, cd-rumble 2.8s linear infinite; }
        #cd-pet[data-mood="sleeping"] .cd-body-rig { animation: cd-breathe-slow 4.8s ease-in-out infinite; }
        #cd-pet[data-mood="sleeping"] .cd-tail { animation: none; }
        #cd-pet[data-mood="sleeping"] .cd-zzz { opacity: 1; }
        #cd-pet[data-mood="sleeping"] .cd-zzz text { animation: cd-zzz-float 2.6s ease-out infinite; }
        #cd-pet[data-mood="sleeping"] .cd-zzz text:nth-child(2) { animation-delay: 1.3s; }

        /* imported-art adaptations: parts carry their pivot at local (0,0),
           and px-tuned keyframes need art-space magnitudes (÷0.1088 scale) */
        #cd-pet.cd-imported .cd-ear-l, #cd-pet.cd-imported .cd-ear-r,
        #cd-pet.cd-imported .cd-tail { transform-origin: 0 0; }
        /* arrival: a gold glow that fades, and a soft pop-in */
        #cd-pet.cd-arrive { animation: cd-arrive-glow 3s ease-out both; }
        #cd-pet.cd-arrive .cd-body-rig { animation: cd-arrive-pop .9s cubic-bezier(.2,1.5,.4,1) both; }
        @keyframes cd-arrive-glow {
          0% { filter: drop-shadow(0 0 0 rgba(255,201,90,0)) }
          12% { filter: drop-shadow(0 0 14px rgba(255,214,110,.95)) drop-shadow(0 0 34px rgba(255,201,90,.85)) drop-shadow(0 0 70px rgba(255,190,60,.6)) }
          55% { filter: drop-shadow(0 0 10px rgba(255,214,110,.7)) drop-shadow(0 0 26px rgba(255,201,90,.5)) }
          100% { filter: drop-shadow(0 2px 3px rgba(0,0,0,.18)) } }
        @keyframes cd-arrive-pop { 0% { transform: scale(.4); opacity: 0 } 60% { transform: scale(1.12); opacity: 1 } 100% { transform: scale(1) } }

        /* whiskers (species that have them): six independent pivots at the cheek.
           A slow staggered sway is always on; they twitch on an ear flick, flutter
           on the move, flare up on a jump, droop when he's down or asleep. */
        #cd-pet.cd-imported .cd-wh { transform-origin: 0 0; animation: cd-wh-sway-r 3.4s ease-in-out infinite; }
        #cd-pet.cd-imported .cd-wh-l { animation-name: cd-wh-sway-l; }
        #cd-pet.cd-imported .cd-whiskers > g:nth-child(2) .cd-wh { animation-delay: -.7s; }
        #cd-pet.cd-imported .cd-whiskers > g:nth-child(3) .cd-wh { animation-delay: -1.5s; }
        @keyframes cd-wh-sway-r { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-2.4deg) } }
        @keyframes cd-wh-sway-l { 0%,100% { transform: rotate(0) } 50% { transform: rotate(2.4deg) } }
        /* a prop riding the head (capybara tangerine): bobs with the gait, tips when sad, jumps with him */
        #cd-pet.cd-imported .cd-prop { transform-origin: 0 0; pointer-events: auto; cursor: pointer; }
        #cd-pet.cd-imported.cd-walking .cd-prop, #cd-pet.cd-imported.cd-scurry .cd-prop { animation: cd-prop-bob .46s ease-in-out infinite; }
        #cd-pet.cd-imported[data-mood="sad"] .cd-prop { transform: rotate(-9deg); }
        #cd-pet.cd-imported.cd-jumping .cd-prop, #cd-pet.cd-imported.cd-ultra .cd-prop { animation: cd-prop-hop .95s cubic-bezier(.34,1.4,.5,1) 1; }
        @keyframes cd-prop-bob { 0%,100% { transform: rotate(-2deg) } 50% { transform: rotate(3deg) translateY(-6px) } }
        #cd-pet[data-prop="off"] .cd-prop { opacity: 0; }
        #cd-pet.cd-prop-pop .cd-prop { animation: cd-prop-pop .9s cubic-bezier(.34,1.5,.5,1) 1; }
        @keyframes cd-prop-pop { 0% { transform: scale(0) translateY(-80px) } 60% { transform: scale(1.15) } 100% { transform: scale(1) } }
        }
        }
        @keyframes cd-prop-hop { 0%,100% { transform: translateY(0) } 35% { transform: translateY(-40px) rotate(8deg) } }
        /* short stiff whiskers (capybara) need a wider swing to read at pet size */
        #cd-pet.cd-imported .cd-wh.cd-wh-wide { animation-name: cd-wh-sway-wide-r; }
        #cd-pet.cd-imported .cd-wh-l.cd-wh-wide { animation-name: cd-wh-sway-wide-l; }
        @keyframes cd-wh-sway-wide-r { 0%,100% { transform: rotate(0) } 50% { transform: rotate(-7deg) } }
        @keyframes cd-wh-sway-wide-l { 0%,100% { transform: rotate(0) } 50% { transform: rotate(7deg) } }
        #cd-pet.cd-imported.cd-walking .cd-wh, #cd-pet.cd-imported.cd-scurry .cd-wh { animation-duration: .9s; }
        #cd-pet.cd-imported.cd-idle-earflick .cd-wh-r { animation: cd-wh-twitch-r .55s ease-in-out 2; }
        #cd-pet.cd-imported.cd-idle-earflick .cd-wh-l { animation: cd-wh-twitch-l .55s ease-in-out 2; }
        @keyframes cd-wh-twitch-r { 0%,100% { transform: rotate(0) } 30% { transform: rotate(-6deg) } 70% { transform: rotate(3deg) } }
        @keyframes cd-wh-twitch-l { 0%,100% { transform: rotate(0) } 30% { transform: rotate(6deg) } 70% { transform: rotate(-3deg) } }
        #cd-pet.cd-imported.cd-jumping .cd-wh-r, #cd-pet.cd-imported.cd-ultra .cd-wh-r { animation: cd-wh-flare-r .95s cubic-bezier(.34,1.4,.5,1) 1; }
        #cd-pet.cd-imported.cd-jumping .cd-wh-l, #cd-pet.cd-imported.cd-ultra .cd-wh-l { animation: cd-wh-flare-l .95s cubic-bezier(.34,1.4,.5,1) 1; }
        @keyframes cd-wh-flare-r { 0%,100% { transform: rotate(0) } 35% { transform: rotate(-9deg) } }
        @keyframes cd-wh-flare-l { 0%,100% { transform: rotate(0) } 35% { transform: rotate(9deg) } }
        #cd-pet.cd-imported[data-mood="sad"] .cd-wh-r, #cd-pet.cd-imported[data-mood="hungry"] .cd-wh-r { animation-name: cd-wh-droop-r; animation-duration: 4.6s; }
        #cd-pet.cd-imported[data-mood="sad"] .cd-wh-l, #cd-pet.cd-imported[data-mood="hungry"] .cd-wh-l { animation-name: cd-wh-droop-l; animation-duration: 4.6s; }
        @keyframes cd-wh-droop-r { 0%,100% { transform: rotate(5deg) } 50% { transform: rotate(7deg) } }
        @keyframes cd-wh-droop-l { 0%,100% { transform: rotate(-5deg) } 50% { transform: rotate(-7deg) } }
        #cd-pet.cd-imported[data-mood="sleeping"] .cd-wh-r, #cd-pet.cd-imported.cd-resting .cd-wh-r { animation: none; transform: rotate(6deg); }
        #cd-pet.cd-imported[data-mood="sleeping"] .cd-wh-l, #cd-pet.cd-imported.cd-resting .cd-wh-l { animation: none; transform: rotate(-6deg); }
        #cd-pet.cd-imported.cd-resting .cd-pose-awake { display: block; }
        #cd-pet.cd-imported.cd-resting .cd-ear-l { transform: rotate(-8deg); }
        #cd-pet.cd-imported.cd-resting .cd-ear-r { transform: rotate(8deg); }
        @keyframes cd-zzz-float-big { 0% { opacity: 0; transform: translate(0,0) } 30% { opacity: .8 } 100% { opacity: 0; transform: translate(92px,-240px) } }
        #cd-pet.cd-imported.cd-resting .cd-zzz text,
        #cd-pet.cd-imported[data-mood="sleeping"] .cd-zzz text { animation-name: cd-zzz-float-big; }
        #cd-pet.cd-imported.cd-resting .cd-zzz { transform: none; }
        @media (prefers-reduced-motion: reduce) {
          #cd-pet .cd-body-rig, #cd-pet .cd-tail, #cd-pet .cd-zzz text { animation: none !important; }
        }
      </style>
      <svg viewBox="0 0 100 100" width="${SIZE}" height="${SIZE}" aria-hidden="true">
        <defs>
          <linearGradient id="cdgFur" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#EBCFA0"/><stop offset="55%" stop-color="#D9B57F"/><stop offset="100%" stop-color="#C09659"/>
          </linearGradient>
          <linearGradient id="cdgEar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#A17547"/><stop offset="100%" stop-color="#83603A"/>
          </linearGradient>
          <linearGradient id="cdgCream" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#F5E9D2"/><stop offset="100%" stop-color="#E3D1AF"/>
          </linearGradient>
        </defs>
        <ellipse class="cd-shadow" cx="50" cy="95.5" rx="25" ry="3.1" fill="rgba(40,30,15,.15)"/>
        <g class="cd-jump-rig">
          <g class="cd-body-rig">
            <g class="cd-facing">
              <g class="cd-pose-awake">
              <path class="cd-tail" d="M30 82 Q17 82 13 71 Q11 64 17 64 Q20 72 32 75 Z" fill="url(#cdgEar)" stroke="#6B4A26" stroke-width="1.8" stroke-linejoin="round"/>
              <ellipse cx="50" cy="75" rx="23" ry="18" fill="url(#cdgFur)" stroke="#6B4A26" stroke-width="1.8"/>
              <ellipse cx="50" cy="82" rx="15" ry="10" fill="url(#cdgCream)"/>
              <ellipse cx="50" cy="64" rx="16" ry="3.8" fill="rgba(140,95,35,.13)"/>
              <path class="cd-collar" d="M33 63 Q50 72 67 63" stroke="#CD5A4E" stroke-width="5" fill="none" stroke-linecap="round"/>
              <circle class="cd-collar-tag" cx="50" cy="69.5" r="3" fill="#E3BC6B"/>
              <ellipse cx="38" cy="92" rx="8.5" ry="5" fill="#A17547" stroke="#6B4A26" stroke-width="1.8"/>
              <ellipse cx="62" cy="92" rx="8.5" ry="5" fill="#A17547" stroke="#6B4A26" stroke-width="1.8"/>
              <circle cx="50" cy="38" r="26" fill="url(#cdgFur)" stroke="#6B4A26" stroke-width="1.8"/>
              <ellipse cx="42" cy="22" rx="12" ry="6.5" fill="#F2DCB2" opacity=".25"/>
              <path d="M60 14 A26 26 0 0 1 76 36 L61 43 Q55 28 57 13 Z" fill="#A97F4E"/>
              <g class="cd-ear-l">
                <path d="M30 16 Q18 20 17 36 Q16.5 47 24 46 Q31 45 33 32 Q34 22 30 16 Z" fill="url(#cdgEar)" stroke="#6B4A26" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M21 36 Q20.5 44.5 24.5 44.3 Q28.5 43.6 30.2 35 Q26 39.5 21 36 Z" fill="rgba(120,75,30,.30)"/>
              </g>
              <g class="cd-ear-r">
                <path d="M70 16 Q82 20 83 36 Q83.5 47 76 46 Q69 45 67 32 Q66 22 70 16 Z" fill="url(#cdgEar)" stroke="#6B4A26" stroke-width="1.8" stroke-linejoin="round"/>
                <path d="M79 36 Q79.5 44.5 75.5 44.3 Q71.5 43.6 69.8 35 Q74 39.5 79 36 Z" fill="rgba(120,75,30,.30)"/>
              </g>
              <ellipse cx="50" cy="50" rx="13.5" ry="10" fill="url(#cdgCream)" stroke="#6B4A26" stroke-width="1.5"/>
              <g class="cd-eyes-open">
                <ellipse cx="37" cy="43" rx="8" ry="8.4" fill="#FBF6EA"/>
                <ellipse cx="63" cy="43" rx="8" ry="8.4" fill="#FBF6EA"/>
                <g class="cd-pupils">
                  <circle cx="37.3" cy="44" r="5.9" fill="#2B2A33"/>
                  <circle cx="63.3" cy="44" r="5.9" fill="#2B2A33"/>
                  <circle cx="39.1" cy="41.9" r="1.5" fill="#fff" opacity=".8"/>
                  <circle cx="65.1" cy="41.9" r="1.5" fill="#fff" opacity=".8"/>
                </g>
              </g>
              <g class="cd-lids" opacity="0">
                <rect x="28.6" y="33.8" width="16.8" height="17" rx="8.4" fill="url(#cdgFur)"/>
                <rect x="54.6" y="33.8" width="16.8" height="17" rx="8.4" fill="url(#cdgFur)"/>
              </g>
              <ellipse cx="50" cy="48.5" rx="4.6" ry="3.4" fill="#45362B"/>
              <path class="cd-mouth-happy" d="M50 51.5 L50 54.5 M50 54.5 Q45.5 58.5 42.5 55 M50 54.5 Q54.5 58.5 57.5 55" stroke="#45362B" stroke-width="2.2" fill="none" stroke-linecap="round"/>
              <path class="cd-mouth-sad" d="M43.5 58 Q50 53 56.5 58" stroke="#45362B" stroke-width="2.2" fill="none" stroke-linecap="round"/>
              <g class="cd-mouth-open">
                <ellipse cx="50" cy="56.5" rx="5" ry="5.4" fill="#45362B"/>
                <ellipse cx="50" cy="59" rx="3.1" ry="2.6" fill="#F26D7D"/>
              </g>
              </g>
              <!-- proper curled sleeping pose: swapped in while resting -->
              <g class="cd-pose-sleep">
                <path d="M18 88 Q14 70 36 64 Q64 56 80 68 Q88 76 82 86 Q72 94 42 94 Q24 94 18 88 Z" fill="url(#cdgFur)" stroke="#6B4A26" stroke-width="1.8" stroke-linejoin="round"/>
                <ellipse cx="58" cy="88" rx="20" ry="6.5" fill="#FFF3E2" opacity=".5"/>
                <path d="M76 84 Q88 88 80 93 Q70 96 64 92 Q70 90 76 84 Z" fill="url(#cdgEar)" stroke="#6B4A26" stroke-width="1.6" stroke-linejoin="round"/>
                <circle cx="32" cy="76" r="16" fill="url(#cdgFur)" stroke="#6B4A26" stroke-width="1.8"/>
                <path d="M24 62 Q12 66 14 80 Q15 88 22 86 Q28 84 28 72 Q28 64 24 62 Z" fill="url(#cdgEar)" stroke="#6B4A26" stroke-width="1.6" stroke-linejoin="round"/>
                <ellipse cx="22" cy="82" rx="8" ry="6" fill="url(#cdgCream)" stroke="#6B4A26" stroke-width="1.4"/>
                <ellipse cx="17.5" cy="80" rx="3.4" ry="2.6" fill="#45362B"/>
                <path d="M34 75 q3.4 2.8 6.8 0" stroke="#45362B" stroke-width="2.2" fill="none" stroke-linecap="round"/>
                <path d="M40 68 Q44 64 50 65" stroke="#C8A163" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/>
              </g>
              <g class="cd-zzz" font-family="Georgia, serif" font-weight="700" fill="#B08D5B">
                <text x="74" y="24" font-size="13">z</text>
                <text x="82" y="16" font-size="10">z</text>
              </g>
            </g>
          </g>
        </g>
      </svg>
    `;
    return wrap;
  }

  // ---- bed: back wall and cushion behind the pet, front lip and blanket above it ----

  const BED_ENABLED = false;
  const BED_W = 152, BED_H = 52;

  function buildBed() {
    const el = document.createElement("div");
    el.id = "cd-pet-bed";
    el.style.cssText = `
      position: fixed; bottom: 0; left: 28px; width: ${BED_W}px; height: ${BED_H}px;
      z-index: 2147483644; cursor: grab; user-select: none;
      filter: drop-shadow(0 2px 2px rgba(0,0,0,.15));
      opacity: 0; transition: opacity .45s ease;
    `;
    el.innerHTML = `
      <svg viewBox="0 0 152 52" width="${BED_W}" height="${BED_H}" aria-hidden="true" style="overflow:visible">
        <defs>
          <linearGradient id="cdgBedRim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#D8B48D"/><stop offset="100%" stop-color="#B98F63"/>
          </linearGradient>
        </defs>
        <!-- back wall -->
        <ellipse cx="76" cy="26" rx="72" ry="22" fill="url(#cdgBedRim)"/>
        <!-- inner wall shadow -->
        <ellipse cx="76" cy="29" rx="61" ry="16" fill="#9A7450"/>
        <!-- cushion -->
        <ellipse cx="76" cy="32" rx="57" ry="13" fill="#FFF3E0"/>
        <path d="M34 32 Q76 40 118 32" stroke="#EBD9BE" stroke-width="2" fill="none"/>
        <path d="M44 27 Q76 34 108 27" stroke="#EBD9BE" stroke-width="2" fill="none"/>
      </svg>`;
    return el;
  }

  function buildBedFront() {
    const el = document.createElement("div");
    el.id = "cd-pet-bed-front";
    el.style.cssText = `
      position: fixed; bottom: 0; left: 28px; width: ${BED_W}px; height: ${BED_H}px;
      z-index: 2147483646; pointer-events: none; user-select: none;
      opacity: 0; transition: opacity .45s ease;
    `;
    el.innerHTML = `
      <style>
        #cd-pet-bed-front .cd-bed-blanket { opacity: 0; transition: opacity .5s ease .15s; transform: translate(-8px, 2px); }
        #cd-pet-bed-front.cd-tucked .cd-bed-blanket { opacity: 1; }
      </style>
      <svg viewBox="0 0 152 52" width="${BED_W}" height="${BED_H}" aria-hidden="true" style="overflow:visible">
        <!-- blanket: drapes the body's rear half, head stays on the pillow -->
        <g class="cd-bed-blanket">
          <path d="M80 24 Q78 -4 106 -13 Q132 -17 138 4 Q140 20 127 31 Q102 37 85 32 Q78 30 80 24 Z" fill="#A8C6EC"/>
          <path d="M86 8 Q108 -8 132 2" stroke="#8FB2E0" stroke-width="3" fill="none" stroke-linecap="round"/>
          <path d="M84 18 Q110 2 136 12" stroke="#8FB2E0" stroke-width="3" fill="none" stroke-linecap="round" opacity=".7"/>
        </g>
        <!-- front lip of the basket (crescent) -->
        <path d="M4 26 A72 22 0 0 0 148 26 A61 16 0 0 1 4 26 Z" fill="url(#cdgBedRim)"/>
        <path d="M20 38 Q40 46 76 47 Q112 46 132 38" stroke="#A8815A" stroke-width="2.5" fill="none" opacity=".6"/>
      </svg>`;
    return el;
  }

  // ---- engine ----

  const ANCHOR_MS = 120000;
  const ANCHOR_RADIUS = 150;

  const state = {
    x: 120, y: FLOOR, dir: 1,
    mode: "idle",            // idle | walk | oneshot | drag | rest
    mood: "content",
    attention: "chill",      // chill | lively | dnd
    lastInput: Date.now(),
    lastCursor: { x: window.innerWidth / 2, y: window.innerHeight - 120 },
    pinged: false,
    anchor: { x: 0, y: 0, until: 0 },
    resting: false,
    wired: false,
    bed: { x: 28, y: 0 },
    tickTimer: null, raf: null,
  };
  let pet, bedEl, bedFrontEl, IDLES = [];

  // home is re-rolled on every trip back, so he never settles into one corner
  function randomEdgeSpot() {
    const W = window.innerWidth, H = window.innerHeight;
    const side = Math.random();
    if (side < 0.55) return { x: clampX(20 + Math.random() * (W - SIZE - 40)), y: FLOOR };
    const y = clampY(Math.random() * H * 0.45);
    return { x: side < 0.775 ? 8 : W - SIZE - 8, y };
  }
  function newHome() { state.home = randomEdgeSpot(); return state.home; }
  function bedSpot() {
    if (!BED_ENABLED) { const h = state.home ?? newHome(); return { x: clampX(h.x), y: clampY(h.y) }; }
    return { x: state.bed.x + (BED_W - SIZE) / 2, y: state.bed.y + 12 };
  }

  function syncBedPos() {
    for (const el of [bedEl, bedFrontEl]) {
      if (!el) continue;
      el.style.transform = `translate3d(${state.bed.x}px, ${-state.bed.y}px, 0)`;
    }
  }

  function anchorPoint() {
    if (Date.now() < state.anchor.until) return { x: state.anchor.x, y: state.anchor.y };
    return bedSpot();
  }

  function onBed() {
    if (!BED_ENABLED) return false;
    const s = bedSpot();
    return Math.hypot(state.x - s.x, state.y - s.y) < 60;
  }

  function rest() {
    interrupt();
    clearOneShotClasses();
    const s = bedSpot();
    setPos(s.x, s.y);
    state.resting = true;
    state.mode = "rest";
    pet.classList.add("cd-resting");
    bedFrontEl?.classList.add("cd-tucked");
    persist();
  }

  function wake() {
    if (!state.resting) return;
    state.resting = false;
    pet.classList.remove("cd-resting");
    bedFrontEl?.classList.remove("cd-tucked");
    setMood(state.mood);
    state.mode = "idle";
    persist();
  }

  // ---------- expression ----------

  function setMouth(which) {
    for (const m of ["happy", "sad", "open"]) {
      const el = pet.querySelector(`.cd-mouth-${m}`);
      if (el) el.style.opacity = m === which ? "1" : "0";
    }
  }

  function setMood(mood) {
    state.mood = mood;
    pet.dataset.mood = mood;
    setMouth(mood === "sad" || mood === "hungry" ? "sad" : "happy");
    pet.querySelector(".cd-lids")?.setAttribute("opacity", mood === "sleeping" ? "1" : "0");
    persist(); // the popup reads mood from storage
  }

  async function mountArtInto(holder, speciesKey) {
    const sp = SPECIES[speciesKey];
    const txt = await (await fetch(chrome.runtime.getURL(sp.art))).text();
    const inner = txt.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
    holder.querySelector(".cd-facing").innerHTML = `<g transform="${sp.transform}">${inner}</g>`;
    holder.classList.add("cd-imported");
    holder.dataset.species = speciesKey;
    holder.dataset.idles = sp.idles;
  }

  // ---------- visits: a classmate's pet wanders onto the page ----------
  const VISITS = false;
  /* @strip:visits */
  // ---------- animal dynamics ----------
  const DYNAMICS = { "pup|pup": "friend", "cat|cat": "neutral", "pup|cat": "rival", "pup|gecko": "friend", "cat|gecko": "rival" };
  function relation(a, b) {
    if (a === "capy" || b === "capy") return "friend";
    return DYNAMICS[`${a}|${b}`] ?? DYNAMICS[`${b}|${a}`] ?? "neutral";
  }
  // one token per pet.js instance on the page, to spot double injection
  const INSTANCE = Math.random().toString(36).slice(2, 6);
  document.documentElement.dataset.cdInstances = ((document.documentElement.dataset.cdInstances || "") + " " + INSTANCE).trim();
  const VISITS_PER_DAY = 4, DEMO_VISITS_PER_DAY = 1, VISITOR_SPEED = 95; // px/s
  let visitor = null;
  async function visitsEnabled() { const { visits_enabled } = await chrome.storage.local.get("visits_enabled"); return visits_enabled === true; }
  async function visitQuota() {
    const today = new Date().toDateString();
    const { cd_visits } = await chrome.storage.local.get("cd_visits");
    return cd_visits?.date === today ? cd_visits : { date: today, n: 0, demo: 0 };
  }
  function scheduleVisit(firstLoad) {
    const delay = firstLoad ? (4 + Math.random() * 16) * 60000 : (90 + Math.random() * 90) * 60000;
    setTimeout(async () => {
      try { await tryVisit(); } catch (e) { log("visit failed", String(e)); }
      scheduleVisit(false);
    }, delay);
  }
  async function tryVisit(force = false, override = null) {
    if (!VISITS) return;
    const why = (m) => { document.documentElement.dataset.cdVisit = `${m} [${INSTANCE} pet:${pet ? (pet.isConnected ? "live" : "detached") : "none"}]`; log("visit:", m); };
    if (visitor) return why("busy");
    if (!force && document.hidden) return why("hidden");
    if (!pet?.isConnected) return why("no pet");
    if (!force && !(await visitsEnabled())) return;
    const q = await visitQuota();
    if (!force && q.n >= VISITS_PER_DAY) return;
    const { device_id, cd_courses } = await chrome.storage.local.get(["device_id", "cd_courses"]);
    let courses = cd_courses?.host === location.host ? cd_courses.ids : [];
    if (!courses.length && typeof syncCourses === "function") courses = await syncCourses(); // content.js helper, same content-script world
    if (!device_id || !courses.length) return why("no courses");
    let v = override;
    if (!v) {
      try { v = await netVisitor(device_id, location.host, courses); } catch (e) { return why("server " + e.message); }
    }
    if (!v) return why("nobody");
    why("visitor " + (v.nick || ""));
    if (!force && v.demo && q.demo >= DEMO_VISITS_PER_DAY) return;
    if (!force) { q.n++; if (v.demo) q.demo++; await chrome.storage.local.set({ cd_visits: q }); }
    await showVisitor(v);
  }
  async function showVisitor(v) {
    const el = buildRig();
    el.id = "cd-visitor";
    el.querySelectorAll("style").forEach((st) => { st.textContent = st.textContent.replaceAll("#cd-pet", "#cd-visitor"); });
    el.style.cursor = "pointer"; el.style.zIndex = "2147483645";
    const sp = speciesFor(v.animal);
    document.body.appendChild(el);
    await mountArtInto(el, sp);
    const def = COLLAR_DEFS.find((d) => d.id === v.collar);
    const vis = { el, tag: null, x: 0, dir: -1, moving: false, stopMotes: null, v };
    if (def) {
      applyCollarDef(el.querySelector("svg"), def, "visitor");
      vis.stopMotes = collarMoteLoop(def, document.body, () => vis.el.isConnected ? { x: vis.x, y: window.innerHeight - SIZE, w: SIZE, h: SIZE, dir: vis.dir, moving: vis.moving } : null, true);
    }
    const tag = document.createElement("div");
    tag.textContent = v.nick || "";
    tag.style.cssText = `position: fixed; z-index: 2147483645; pointer-events: auto; cursor: pointer; white-space: nowrap;
      background: rgba(28,32,44,.82); color: #fff; border-radius: 9px; padding: 2px 8px; font: 800 11px/1.4 "Nunito", -apple-system, sans-serif;
      transform: translate(-50%, 0); opacity: 0; transition: opacity .4s;`;
    document.body.appendChild(tag);
    vis.tag = tag;
    const fromLeft = state.x > window.innerWidth / 2; // enter from the far side
    vis.x = fromLeft ? -SIZE : window.innerWidth + 8; vis.dir = fromLeft ? 1 : -1;
    visitor = vis;
    const place = () => {
      el.style.transform = `translate3d(${vis.x}px, 0, 0)`;
      const g = el.querySelector(".cd-facing"); g.style.transformOrigin = "50% 50%"; g.style.transform = vis.dir === 1 ? "scaleX(-1)" : "";
      tag.style.left = `${vis.x + SIZE / 2}px`; tag.style.top = `${window.innerHeight - SIZE + 2}px`; // the art sits low in its box
    };
    place(); el.style.opacity = "1"; tag.style.opacity = "1";
    const walk = (tx) => new Promise((done) => {
      vis.moving = true; el.classList.add("cd-walking"); vis.dir = tx > vis.x ? 1 : -1;
      let last = performance.now();
      const step = (now) => {
        if (!vis.el.isConnected) return done();
        const dt = (now - last) / 1000; last = now;
        const d = tx - vis.x, mv = Math.sign(d) * Math.min(Math.abs(d), VISITOR_SPEED * dt);
        vis.x += mv; place();
        if (Math.abs(tx - vis.x) < 1) { vis.moving = false; el.classList.remove("cd-walking"); return done(); }
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    const visitKey = `visit:${new Date().toDateString()}:${Date.now()}`;
    let rewarded = false;
    el.addEventListener("pointerdown", (e) => {
      e.stopPropagation(); e.preventDefault();
      el.classList.add("cd-jumping"); setTimeout(() => el.classList.remove("cd-jumping"), 950);
      if (!rewarded && window.cdEarn) { rewarded = true; window.cdEarn("visit", visitKey, null, { x: e.clientX, y: e.clientY }); }
    });
    tag.addEventListener("pointerdown", (e) => { e.stopPropagation(); e.preventDefault(); showPlayerCard(v, vis); });
    const rel = relation(species, sp);
    const gap = rel === "friend" ? SIZE * 0.7 : rel === "rival" ? SIZE + 110 : SIZE + 70;
    const beside = clampX(state.x + (fromLeft ? -1 : 1) * gap);
    await walk(beside);
    vis.dir = state.x > vis.x ? 1 : -1; place();
    chrome.storage.local.get("cd_first_visit").then(({ cd_first_visit }) => { if (!cd_first_visit) chrome.storage.local.set({ cd_first_visit: { at: Date.now(), nick: v.nick || "" } }); }).catch(() => {}); // read by the popup's first-visit screen
    const faceVisitor = () => { state.dir = vis.x > state.x ? 1 : -1; facing(); };
    let wary = false;
    if (rel === "friend") {
      faceVisitor(); emitMotes("heart", { count: 6, slow: true }); happyJump();
      setTimeout(() => { el.classList.add("cd-jumping"); setTimeout(() => el.classList.remove("cd-jumping"), 950); }, 350);
    } else if (rel === "rival") {
      wary = true; interrupt(); clearOneShotClasses();
      const away = clampX(state.x + (vis.x > state.x ? -1 : 1) * 190);
      moveTo(away, FLOOR, { scurry: true, then: () => { faceVisitor(); pet.dataset.mood = "sad"; } });
      el.classList.add("cd-idle-look"); setTimeout(() => el.classList.remove("cd-idle-look"), IDLE_MS.look);
    } else {
      emitMotes("heart", { count: 2, slow: true });
    }
    const idles = (SPECIES[sp].idles || "sit").split(",").filter((i) => i !== "snack");
    const stay = (rel === "friend" ? 90000 + Math.random() * 50000 : rel === "rival" ? 35000 + Math.random() * 20000 : 70000 + Math.random() * 40000), t0 = Date.now();
    while (Date.now() - t0 < stay && vis.el.isConnected) {
      await new Promise((r) => setTimeout(r, 5000 + Math.random() * 5000));
      let idle = idles[Math.floor(Math.random() * idles.length)];
      if (rel === "rival") idle = Math.random() < 0.6 ? "look" : idle;
      el.classList.add(`cd-idle-${idle}`); setTimeout(() => el.classList.remove(`cd-idle-${idle}`), IDLE_MS[idle] ?? 3000);
      if (rel === "friend") {
        if (idle === "sit" && state.mode === "idle") { pet.classList.add("cd-idle-sit"); setTimeout(() => pet.classList.remove("cd-idle-sit"), IDLE_MS.sit); }
        if (Math.random() < 0.5) emitMotes("heart", { count: 2, slow: true });
      }
    }
    if (wary) { pet.dataset.mood = state.mood; setMood(state.mood); }
    if (!vis.el.isConnected) return;
    tag.style.opacity = "0";
    await walk(vis.x < window.innerWidth / 2 ? -SIZE - 10 : window.innerWidth + 10);
    endVisit();
  }
  function endVisit() {
    if (!visitor) return;
    visitor.stopMotes?.(); visitor.el.remove(); visitor.tag?.remove();
    document.getElementById("cd-player-card")?.remove();
    visitor = null;
  }
  function showPlayerCard(v, vis) {
    document.getElementById("cd-player-card")?.remove();
    const card = document.createElement("div");
    card.id = "cd-player-card";
    const glyph = (id) => { const d = COLLAR_DEFS.find((x) => x.id === id); if (!d) return ""; const w = document.createElement("div"); w.innerHTML = collarGlyph(44); applyCollarDef(w.querySelector("svg"), d, "card" + id); return w.innerHTML; };
    const flame = v.best_streak >= 365 ? "#C55BFF" : v.best_streak >= 100 ? "#FF6B3D" : v.best_streak >= 30 ? "#FFA62B" : "#FFC24B";
    card.innerHTML = `<div class="cd-vc-nick" style="font:800 15px/1.2 'Baloo 2','Nunito',sans-serif"></div>
      <div class="cd-vc-pet" style="font:700 12px/1.3 Nunito,sans-serif;color:#6B7387;margin-top:2px"></div>
      <div style="display:flex;gap:10px;align-items:center;margin-top:8px">${(v.showcase || []).map(glyph).join("")}</div>
      <div style="display:flex;align-items:center;gap:6px;margin-top:8px;font:800 14px/1 'Baloo 2',sans-serif;color:${flame}">
        <svg width="16" height="18" viewBox="0 0 16 18"><path d="M8 1 C9 5 13 6 13 11 A5 5 0 0 1 3 11 C3 8 5 7 5 5 C6 7 7 7 8 1Z" fill="${flame}"/></svg>${v.best_streak || 0}</div>
      ${v.pid && !v.demo ? `<button id="cd-add-friend" style="margin-top:10px;width:100%;background:linear-gradient(180deg,#6EA0F5,#5B8DEF);color:#fff;border:none;border-bottom:4px solid #3E6CCB;border-radius:12px;padding:7px 12px;font:800 13px 'Baloo 2',sans-serif;cursor:pointer">Add friend</button>` : ""}`;
    card.querySelector(".cd-vc-nick").textContent = v.nick || ""; card.querySelector(".cd-vc-pet").textContent = v.pet_name || "";
    card.style.cssText = `position: fixed; z-index: 2147483647; left: ${Math.min(Math.max(8, vis.x + SIZE / 2 - 90), window.innerWidth - 188)}px; top: ${window.innerHeight - SIZE - 150}px; width: 180px;
      background: #fff; color: #1E2433; border: 1px solid #DDE3F0; border-bottom: 3px solid #D8DFEA; border-radius: 14px; padding: 12px 14px;
      box-shadow: 0 10px 30px rgba(30,50,110,.18); font-family: Nunito, -apple-system, sans-serif;`;
    document.body.appendChild(card);
    const add = card.querySelector("#cd-add-friend");
    if (add) {
      chrome.storage.local.get("cd_econ").then(({ cd_econ }) => { if ((cd_econ?.friends || []).includes(v.pid)) { add.textContent = "✓"; add.disabled = true; } });
      add.addEventListener("pointerdown", (e) => e.stopPropagation());
      add.onclick = async (e) => {
        e.stopPropagation();
        add.disabled = true;
        const r = await ledgerSpend("add_friend", { id: v.pid });
        add.textContent = r?.error ? "Add friend" : "✓";
        if (r?.error) add.disabled = false;
      };
    }
    const close = (e) => { if (card.contains(e.target)) return; card.remove(); window.removeEventListener("pointerdown", close, true); };
    setTimeout(() => window.addEventListener("pointerdown", close, true), 0);
  }
  // dev builds only: <html data-cd-dev='{"op":"visit"}'> plus a "cd-dev" event forces a visit
  /* @strip:dev */
  {
    document.addEventListener("cd-dev", async () => {
      await LEDGER_DEV_READY;
      if (!LEDGER_DEV_SECRET) return;
      try { const op = JSON.parse(document.documentElement.dataset.cdDev || "{}"); if (op.op === "visit") { endVisit(); await tryVisit(true, op.animal ? { demo: true, nick: "Test", animal: op.animal, collar: op.collar || "coral", pet_name: "Test", showcase: [], best_streak: 3 } : null); document.documentElement.dataset.cdDevDone = "visit"; } } catch (e) { document.documentElement.dataset.cdVisit = "error " + String(e); }
    });
  }
  /* @/strip:dev */

  /* @/strip:visits */

  async function loadImportArt() {
    try {
      const { cd_econ } = await chrome.storage.local.get("cd_econ");
      species = speciesFor(cd_econ?.equipped?.animal);
      const sp = SPECIES[species];
      const res = await fetch(chrome.runtime.getURL(sp.art));
      const txt = await res.text();
      const inner = txt.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
      const facing = pet.querySelector(".cd-facing");
      facing.innerHTML = `<g transform="${sp.transform}">${inner}</g>`;
      pet.classList.add("cd-imported");
      if (hasProp() && !state.propUntil && Math.random() >= PROP_SPAWN_P) state.propUntil = Date.now() + propAway();
      syncProp();
      pet.dataset.species = species;
      pet.dataset.idles = sp.idles;
      IDLES = sp.idles.split(",");
      applyEquipped();
      log("art mounted", species);
    } catch (err) {
      log("import art failed — using built-in rig", String(err));
    }
  }

  // ---------- world ----------

  function facing() {
    const g = pet.querySelector(".cd-facing");
    g.style.transformOrigin = "50% 50%";
    g.style.transform = state.dir === 1 ? "scaleX(-1)" : "";
  }

  function clampX(x) { return Math.min(Math.max(8, x), window.innerWidth - SIZE - 8); }
  function clampY(y) { return Math.min(Math.max(FLOOR, y), window.innerHeight - SIZE - 20); }

  function setPos(x, y) {
    state.x = clampX(x);
    state.y = clampY(y);
    // transform only, so movement stays on the compositor
    pet.style.transform = `translate3d(${state.x}px, ${-state.y}px, 0)`;
  }

  async function persist() {
    try {
      await chrome.storage.local.set({
        pet_state: {
          x: state.x, y: state.y, dir: state.dir,
          resting: state.resting, anchor: state.anchor, home: state.home,
          mood: state.mood, propUntil: state.propUntil ?? 0, saved_at: Date.now(),
        },
      });
    } catch {}
  }

  // ---------- gaze ----------

  const gaze = { ox: 0, oy: 0, interested: true, glance: null };

  function updateInterest() {
    setTimeout(() => {
      const base = state.mood === "sad" ? 0.12 : state.mood === "hungry" ? 0.35 : 0.2;
      const was = gaze.interested;
      gaze.interested = Math.random() < base;
      if (gaze.interested && !was && Math.random() < 0.35 && state.mode === "idle" && !state.resting) {
        pet.classList.add("cd-idle-earflick");
        setTimeout(() => pet.classList.remove("cd-idle-earflick"), 1300);
      }
      updateInterest();
    }, 5000 + Math.random() * 13000);
  }

  function scheduleGlances() {
    setTimeout(() => {
      if (!gaze.interested && !state.resting && state.mood !== "sleeping") {
        gaze.glance = { x: (Math.random() * 2 - 1) * 2.2, y: (Math.random() * 2 - 1) * 1.5 };
        setTimeout(() => { gaze.glance = null; }, 800 + Math.random() * 900);
      }
      scheduleGlances();
    }, 2600 + Math.random() * 4200);
  }

  function gazeLoop() {
    if (!document.hidden) {
      const pupils = pet.querySelector(".cd-pupils");
      if (pupils) {
        let tx = 0, ty = 0;
        if (!state.resting && state.mood !== "sleeping") {
          if (gaze.interested) {
            const c = state.lastCursor;
            const hx = state.x + SIZE / 2;
            const hy = window.innerHeight - state.y - SIZE * 0.45;
            const dx = c.x - hx, dy = c.y - hy;
            const dist = Math.hypot(dx, dy);
            if (dist < 340 && dist > 1) {
              const fx = state.dir === 1 ? -1 : 1;
              tx = (dx / dist) * 2.2 * fx;
              ty = (dy / dist) * 1.7;
            }
          } else if (gaze.glance) {
            tx = gaze.glance.x; ty = gaze.glance.y;
          }
        }
        gaze.ox += (tx - gaze.ox) * 0.045;
        gaze.oy += (ty - gaze.oy) * 0.045;
        const gm = pet.classList.contains("cd-imported") ? 1 / SPECIES[species].scale : 1;
        pupils.style.transform = `translate(${(gaze.ox * gm).toFixed(2)}px, ${(gaze.oy * gm).toFixed(2)}px)`;
      }
    }
    requestAnimationFrame(gazeLoop);
  }

  // ---------- movement ----------

  function moveTo(tx, ty, { scurry = false, ambient = false, turbo = false, then = null } = {}) {
    interrupt();
    state.mode = "walk";
    state.dir = tx > state.x ? 1 : -1;
    facing();
    pet.classList.add(scurry || turbo ? "cd-scurry" : "cd-walking");
    // gait tempo follows the pace jitter
    const jitter = 0.85 + Math.random() * 0.3;
    pet.style.setProperty("--cd-gait-dur", `${(0.66 / jitter).toFixed(2)}s`);
    const speed = (turbo ? 0.3 : scurry ? 0.16 : state.mood === "sad" ? 0.032 : 0.055) * (scurry || turbo ? 1 : jitter);
    let last = performance.now();
    const step = (now) => {
      if (state.mode !== "walk") return;
      const dt = now - last; last = now;
      if (ambient && Math.random() < 0.0009) {
        pet.classList.remove("cd-walking", "cd-scurry");
        state.mode = "idle";
        persist();
        return doIdle();
      }
      const dx = tx - state.x, dy = ty - state.y;
      const dist = Math.hypot(dx, dy);
      if (dist < speed * dt) {
        setPos(tx, ty);
        pet.classList.remove("cd-walking", "cd-scurry");
        state.mode = "idle";
        persist();
        if (then) then(); else scheduleTick();
        return;
      }
      setPos(state.x + (dx / dist) * speed * dt, state.y + (dy / dist) * speed * dt);
      state.raf = requestAnimationFrame(step);
    };
    state.raf = requestAnimationFrame(step);
  }

  function interrupt() {
    cancelAnimationFrame(state.raf);
    clearTimeout(state.tickTimer);
    pet.classList.remove("cd-walking", "cd-scurry");
  }

  function goToAnchor(scurry = false) {
    if (state.mode === "drag" || state.resting) return;
    clearOneShotClasses();
    if (Date.now() >= state.anchor.until && !BED_ENABLED) newHome();
    const a = anchorPoint();
    moveTo(a.x, a.y, { scurry });
  }

  function clearOneShotClasses() {
    pet.classList.remove("cd-jumping", "cd-eating", "cd-ultra", "cd-poking", "cd-stubborn", "cd-tc-rev");
    IDLES.forEach((i) => pet.classList.remove(`cd-idle-${i}`));
  }

  // ---------- one-shots ----------

  function oneShot(cls, ms, mouth, after) {
    if (state.mode === "drag") return;
    interrupt();
    state.mode = "oneshot";
    if (mouth) setMouth(mouth);
    pet.classList.add(cls);
    setTimeout(() => {
      pet.classList.remove(cls);
      setMood(state.mood);
      state.mode = "idle";
      if (after) after();
      scheduleTick();
    }, ms);
  }

  const happyJump = () => oneShot("cd-jumping", 950, "open");

  const maybeHeart = (p = 0.1) => { if (Math.random() < p) emitMotes("heart", { count: 8 + Math.floor(Math.random() * 4), slow: true }); };

  function emitMotes(kind, { count = 1, slow = false } = {}) {
    if (!EMOTE_SVG[kind] || document.hidden) return;
    for (let i = 0; i < count; i++) {
      setTimeout(() => {
        const m = document.createElement("div");
        const size = 13 + Math.random() * 8;
        const dur = (slow ? 1.9 : 1.1) + Math.random() * (slow ? 1.1 : 0.7);
        m.style.cssText = `
          position: fixed; pointer-events: none; z-index: 2147483645;
          bottom: ${state.y + SIZE * (0.35 + Math.random() * 0.45)}px;
          left: ${state.x + SIZE * (0.15 + Math.random() * 0.7)}px;
          width: ${size}px; height: ${size}px;
          --mx: ${(Math.random() * 2 - 1) * 22}px;
          animation: cd-mote-float ${dur}s ease-out forwards;`;
        m.innerHTML = `<svg viewBox="0 0 26 26" width="${size}" height="${size}">${EMOTE_SVG[kind]}</svg>`;
        document.body.appendChild(m);
        setTimeout(() => m.remove(), dur * 1000 + 100);
      }, i * (slow ? 150 + Math.random() * 160 : 90 + Math.random() * 120));
    }
  }

  function patReaction() {
    const roll = Math.random();
    const grumpy = state.mood === "sad" || state.mood === "hungry";
    if (grumpy) {
      if (roll < 0.4) return scheduleTick();
      if (roll < 0.7) return oneShot("cd-idle-look", IDLE_MS.look, null);
      return oneShot("cd-idle-wagburst", IDLE_MS.wagburst, null);
    }
    if (roll < 0.35) { maybeHeart(); return happyJump(); }
    if (roll < 0.55) { maybeHeart(); return oneShot("cd-idle-wagburst", IDLE_MS.wagburst, null); }
    if (roll < 0.7) return oneShot("cd-idle-earflick", IDLE_MS.earflick, null);
    if (roll < 0.85) { gaze.interested = true; return oneShot("cd-idle-look", IDLE_MS.look, null); }
    return scheduleTick();
  }
  const eat = () => {
    interrupt();
    state.mode = "oneshot";
    setMouth("open");
    spawnTreat(() => {
      state.mode = "idle";
      oneShot("cd-eating", 1250, "open", () => maybeHeart(0.2));
    });
  };
  const ultraCelebrate = () => { burstConfetti(); oneShot("cd-ultra", 2400, "open"); };

  // ---------- emotes ----------

  const EMOTE_SVG = {
    heart: `<path d="M13 21 C6 15 3 11 5 7.5 C6.6 4.8 10.5 4.9 13 8 C15.5 4.9 19.4 4.8 21 7.5 C23 11 20 15 13 21 Z" fill="#F26D7D"/>`,
    food: `<circle cx="13" cy="13" r="8" fill="#E8A662"/><circle cx="10" cy="11" r="1.4" fill="#8A5426"/><circle cx="15.5" cy="14.5" r="1.4" fill="#8A5426"/><circle cx="13.5" cy="9.5" r="1.1" fill="#8A5426"/>`,
    sad: `<path d="M7 12 a4.5 4.5 0 0 1 1-8.7 A5.5 5.5 0 0 1 18.5 4.5 A4 4 0 0 1 19 12 Z" fill="#9FB4C9"/><path d="M13 15 q-2.6 3.6 0 5.4 q2.6 -1.8 0 -5.4 Z" fill="#6EA0F5"/>`,
    zzz: `<text x="5" y="17" font-family="Georgia,serif" font-weight="700" font-size="13" fill="#8FA9C9">z</text><text x="14" y="11" font-family="Georgia,serif" font-weight="700" font-size="9" fill="#8FA9C9">z</text>`,
  };

  function emote(kind) {
    if (!EMOTE_SVG[kind] || document.hidden) return;
    const b = document.createElement("div");
    b.style.cssText = `
      position: fixed; bottom: ${state.y + SIZE - 6}px; left: ${state.x + SIZE * 0.62}px;
      width: 30px; height: 30px; z-index: 2147483645; pointer-events: none;
      background: #fff; border: 1.5px solid #D5DDE4; border-radius: 50% 50% 50% 12%;
      display: flex; align-items: center; justify-content: center;
      animation: cd-emote-pop 1.7s ease-out forwards;
      filter: drop-shadow(0 1px 2px rgba(0,0,0,.12));`;
    b.innerHTML = `<svg viewBox="0 0 26 26" width="22" height="22">${EMOTE_SVG[kind]}</svg>`;
    document.body.appendChild(b);
    setTimeout(() => b.remove(), 1750);
  }

  function scheduleEmotes() {
    setTimeout(() => {
      if (!document.hidden) {
        if (state.resting) { if (Math.random() < 0.7) emitMotes("zzz"); }
        else if (state.mood === "hungry") emitMotes("food", { count: 1 + (Math.random() < 0.4 ? 1 : 0) });
        else if (state.mood === "sad") emitMotes("sad", { count: 1 + (Math.random() < 0.4 ? 1 : 0) });
        else if (state.mood === "sleeping") emitMotes("zzz");
      }
      scheduleEmotes();
    }, 16000 + Math.random() * 22000);
  }

  // ---------- completion treat ----------

  function spawnTreat(onArrive) {
    const startX = state.x + SIZE / 2 + state.dir * -70;
    const startBottom = state.y + SIZE + 46;
    const mouth = () => ({ x: state.x + SIZE / 2, b: state.y + SIZE * 0.3 });
    const t = document.createElement("div");
    t.style.cssText = `
      position: fixed; bottom: 0; left: 0; width: 16px; height: 16px;
      border-radius: 50%; z-index: 2147483645; pointer-events: none;
      background: radial-gradient(circle at 35% 35%, #E8A662, #B96F2E);
      will-change: transform;
      transform: translate3d(${startX - 8}px, ${-startBottom}px, 0) scale(0);`;
    document.body.appendChild(t);
    const born = performance.now();
    const t0 = born + 240;
    const dur = 620;
    const step = (now) => {
      // pop in place, then a quadratic arc into the mouth
      const popP = Math.min((now - born) / 220, 1);
      const popScale = popP < 0.7 ? 1.3 * (popP / 0.7) : 1.3 - 0.3 * ((popP - 0.7) / 0.3);
      const p = Math.min(Math.max((now - t0) / dur, 0), 1);
      const m = mouth();
      const cx = (startX + m.x) / 2;
      const cb = Math.max(startBottom, m.b) + 55; // arc apex
      const x = (1 - p) ** 2 * startX + 2 * (1 - p) * p * cx + p ** 2 * m.x;
      const b = (1 - p) ** 2 * startBottom + 2 * (1 - p) * p * cb + p ** 2 * m.b;
      const scale = p > 0 ? 1 - p * 0.45 : popScale;
      t.style.transform = `translate3d(${x - 8}px, ${-b}px, 0) scale(${scale}) rotate(${p * 240}deg)`;
      if (p < 1) requestAnimationFrame(step);
      else { t.remove(); if (onArrive) onArrive(); }
    };
    requestAnimationFrame(step);
  }

  function burstConfetti() {
    const colors = ["#6EA0F5", "#F7B2C4", "#E3BC6B", "#7BD389", "#B69CF4"];
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("div");
      const angle = Math.PI * (0.15 + 0.7 * Math.random());
      const dist = 60 + Math.random() * 90;
      p.style.cssText = `
        position: fixed; bottom: ${state.y + SIZE / 2}px; left: ${state.x + SIZE / 2}px;
        width: 7px; height: 7px; border-radius: ${Math.random() > 0.5 ? "50%" : "2px"};
        background: ${colors[i % colors.length]}; z-index: 2147483645;
        transition: transform 1.1s cubic-bezier(.15,.6,.4,1), opacity .4s ease .8s;`;
      document.body.appendChild(p);
      requestAnimationFrame(() => {
        p.style.transform = `translate(${Math.cos(angle) * dist * (Math.random() > 0.5 ? 1 : -1)}px, ${-Math.sin(angle) * dist}px) rotate(${Math.random() * 540}deg)`;
        p.style.opacity = "0";
      });
      setTimeout(() => p.remove(), 1300);
    }
  }

  // ---------- pokes ----------

  function pokeTargets() {
    const meaningful = [];
    const playful = [];
    for (const row of document.querySelectorAll('[data-testid="planner-item-raw"]')) {
      const r = row.getBoundingClientRect();
      if (r.top > 40 && r.bottom < window.innerHeight - 40 && r.width > 100) {
        (meaningful.length === 0 ? meaningful : playful).push(row); // first visible row is the one due soonest
      }
    }
    for (const el of document.querySelectorAll("#dashboard_header_container, .ic-app-header__logomark, #grades_summary tr.student_assignment th.title")) {
      const r = el.getBoundingClientRect();
      if (r.top > 40 && r.bottom < window.innerHeight - 40) playful.push(el);
    }
    return { meaningful, playful };
  }

  function pokeAt(el, meaningful) {
    const r = el.getBoundingClientRect();
    const tx = clampX(r.left + Math.min(r.width * 0.3, 200));
    const ty = clampY(window.innerHeight - r.bottom - SIZE * 0.35);
    const startedAt = { sx: window.scrollX, sy: window.scrollY };
    moveTo(tx, ty, {
      then: () => {
        // the target moved if the page scrolled mid-approach
        if (Math.abs(window.scrollY - startedAt.sy) > 30) return goToAnchor(true);
        if (meaningful) pulse(el);
        oneShot("cd-poking", 1300, null, () => {
          setTimeout(() => { if (state.mode === "idle" && state.attention === "chill") goToAnchor(); }, 1200);
        });
      },
    });
  }

  function pulse(el) {
    const prev = el.style.boxShadow;
    el.style.transition = "box-shadow .5s ease";
    el.style.boxShadow = "0 0 0 3px rgba(110,160,245,.45)";
    setTimeout(() => { el.style.boxShadow = prev; }, 1600);
  }

  // ---------- attention ----------

  function noteInput() {
    const wasAfk = state.attention === "lively";
    state.lastInput = Date.now();
    if (wasAfk) {
      state.attention = "chill";
      goToAnchor(true);
    }
  }

  function refreshAttention() {
    if (state.attention === "dnd") return;
    const afk = Date.now() - state.lastInput > AFK_MS;
    state.attention = afk ? "lively" : "chill";
  }

  // ---------- scheduler ----------

  function scheduleTick() {
    clearTimeout(state.tickTimer);
    if (state.attention === "dnd" || state.mood === "sleeping" || state.resting) return;
    refreshAttention();
    const lively = state.attention === "lively";
    const sluggish = state.mood === "sad" ? 2 : 1;
    const wait = (lively ? 1500 + Math.random() * 4000 : 4000 + Math.random() * 9000) * sluggish;
    state.tickTimer = setTimeout(act, wait);
  }

  function act() {
    if (state.mode !== "idle" || document.hidden) return scheduleTick();
    refreshAttention();
    const lively = state.attention === "lively";
    const roll = Math.random();

    if (lively) {
      if (roll < 0.35) {
        moveTo(40 + Math.random() * (window.innerWidth - SIZE - 80),
               Math.random() * (window.innerHeight * 0.6), { ambient: true });
        return;
      }
      if (roll < 0.6) {
        const { meaningful, playful } = pokeTargets();
        const useMeaningful = meaningful.length && Math.random() < 0.4;
        const pool = useMeaningful ? meaningful : playful.length ? playful : meaningful;
        if (pool.length) return pokeAt(pool[Math.floor(Math.random() * pool.length)], useMeaningful);
      }
      return doIdle();
    }

    // chill: idles, short strolls around the anchor, rare pokes
    if (roll < 0.55) return doIdle();
    if (roll < 0.9) {
      const a = anchorPoint();
      moveTo(clampX(a.x + (Math.random() * 2 - 1) * ANCHOR_RADIUS),
             clampY(a.y + (Math.random() * 2 - 1) * 50), { ambient: true });
      return;
    }
    const { meaningful, playful } = pokeTargets();
    const useMeaningful = meaningful.length && Math.random() < 0.5;
    const pool = useMeaningful ? meaningful : playful;
    if (pool.length) return pokeAt(pool[Math.floor(Math.random() * pool.length)], useMeaningful);
    doIdle();
  }

  const IDLE_WEIGHTS = { sit: 3, look: 3, earflick: 3, sniff: 2.5, stretch: 2, yawn: 2, wagburst: 2, shake: 0.8, tailchase: 0.3, snack: 1.2 };
  const IDLE_MS = { sit: 5000, look: 3400, earflick: 1300, sniff: 2400, stretch: 2300, yawn: 2400, wagburst: 1800, shake: 1500, tailchase: 2900, snack: 3400 };

  // ---------- head prop ----------
  // absent on most fresh loads; once eaten it stays away 45 to 120 min (propUntil is persisted)
  const PROP_SPAWN_P = 0.12;
  const propAway = () => (45 + Math.random() * 75) * 60 * 1000;
  function hasProp() { return Boolean(pet.querySelector(".cd-prop")); }
  function syncProp() {
    if (!hasProp()) return;
    const off = Date.now() < (state.propUntil ?? 0);
    const was = pet.dataset.prop;
    pet.dataset.prop = off ? "off" : "on";
    if (was === "off" && !off) { pet.classList.add("cd-prop-pop"); setTimeout(() => pet.classList.remove("cd-prop-pop"), 900); }
  }
  function tossProp() {
    if (!hasProp() || pet.dataset.prop === "off" || dropped) return;
    const head = pet.querySelector(".cd-prop").getBoundingClientRect();
    pet.dataset.prop = "off";
    state.propUntil = Date.now() + propAway(); persist();
    const dir = Math.random() < 0.5 ? -1 : 1;
    const reach = 60 + Math.random() * 200;
    const x0 = head.left + head.width / 2, y0 = head.top + head.height / 2;
    const x1 = Math.min(Math.max(20, x0 + dir * reach), window.innerWidth - 20);
    const y1 = window.innerHeight - 16;
    const el = document.createElement("div");
    el.style.cssText = `position: fixed; width: 30px; height: 30px; z-index: 2147483647; pointer-events: none;
      filter: drop-shadow(0 2px 3px rgba(0,0,0,.25)); left: ${x0 - 15}px; top: ${y0 - 15}px;`;
    el.innerHTML = `<svg viewBox="0 0 26 26" width="30" height="30">${TREAT_SVG.tangerine}</svg>`;
    document.body.appendChild(el);
    const dx = x1 - x0, dy = y1 - y0, spin = dir * (240 + Math.random() * 240);
    const arc = (t, h) => `translate(${dx * t}px, ${dy * t - h * Math.sin(Math.PI * Math.min(t, 1))}px) rotate(${spin * t}deg)`;
    // arc to the floor, then two bounces
    const keys = [];
    for (let i = 0; i <= 10; i++) keys.push({ transform: arc(i / 10, 60), offset: (i / 10) * 0.62, easing: "linear" });
    keys.push({ transform: `translate(${dx * 1.06}px, ${dy - 26}px) rotate(${spin * 1.1}deg)`, offset: 0.76 });
    keys.push({ transform: `translate(${dx * 1.1}px, ${dy}px) rotate(${spin * 1.18}deg)`, offset: 0.86 });
    keys.push({ transform: `translate(${dx * 1.12}px, ${dy - 8}px) rotate(${spin * 1.2}deg)`, offset: 0.93 });
    keys.push({ transform: `translate(${dx * 1.13}px, ${dy}px) rotate(${spin * 1.22}deg)`, offset: 1 });
    const ms = 700 + Math.abs(dy) * 1.2;
    el.animate(keys, { duration: ms, fill: "forwards" }).onfinish = () => {
      el.remove();
      placeTreat("tangerine", x0 + dx * 1.13, y1, false);
      setTimeout(seekDropped, 350 + Math.random() * 500);
    };
  }
  function eatProp() { tossProp(); }
  function doIdle() {
    const declared = IDLES.filter((i) => IDLE_WEIGHTS[i]);
    const total = declared.reduce((s, i) => s + IDLE_WEIGHTS[i], 0);
    let pick = Math.random() * total;
    let idle = declared[0];
    for (const i of declared) { pick -= IDLE_WEIGHTS[i]; if (pick <= 0) { idle = i; break; } }
    if (dropped && Math.random() < 0.6) return seekDropped();
    const maybeChain = () => { if (Math.random() < 0.18) doIdle(); };
    if (idle === "yawn") return oneShot(`cd-idle-yawn`, IDLE_MS.yawn, "open", maybeChain);
    if (idle === "snack") { if (hasProp() && pet.dataset.prop !== "off" && !dropped) return tossProp(); idle = "sit"; }
    // the tail is on the art's right; the facing flip mirrors it
    if (idle === "tailchase") pet.classList.toggle("cd-tc-rev", state.dir === 1);
    oneShot(`cd-idle-${idle}`, IDLE_MS[idle] ?? 3000, null, maybeChain);
  }

  // ---------- blink ----------

  function scheduleBlink() {
    setTimeout(() => {
      const lids = pet.querySelector(".cd-lids");
      if (lids && state.mood !== "sleeping") {
        lids.setAttribute("opacity", "1");
        setTimeout(() => { if (state.mood !== "sleeping") lids.setAttribute("opacity", "0"); }, 130);
      }
      scheduleBlink();
    }, 2000 + Math.random() * 4000);
  }

  // ---------- leash + pats ----------
  // holding down clips a leash to the collar; the pet walks after the handle

  const LEASH_LEN = 90;
  const COLLAR_FRAC = 0.78; // collar y as a fraction of SIZE from the top

  function collarClientY() { return window.innerHeight - state.y - SIZE + SIZE * COLLAR_FRAC; }

  function enableLeash() {
    let leashSvg = null, leashPath = null, handle = { x: 0, y: 0 };
    let following = false, leashRaf = null, movedFar = false, last = 0;

    function drawLeash() {
      const cx = state.x + SIZE / 2;
      const cy = collarClientY();
      const dx = handle.x - cx, dy = handle.y - cy;
      const dist = Math.hypot(dx, dy);
      const slack = Math.max(0, LEASH_LEN - dist);
      const midX = (handle.x + cx) / 2;
      const midY = (handle.y + cy) / 2 + slack * 0.55 + 10; // sag when slack
      leashPath.setAttribute("d", `M ${handle.x} ${handle.y} Q ${midX} ${midY} ${cx} ${cy}`);
    }

    let stubbornUntil = 0, nextStubbornCheck = 0, strainSince = 0, prevDist = Infinity;
    const leashVel = { x: 0, y: 0 }; // last frame's velocity in px/ms, used by the release glide
    const MAX_PULL = LEASH_LEN * 2.8;

    function cleanupLeash() {
      following = false;
      cancelAnimationFrame(leashRaf);
      // remove by id: a lost pointercancel or a re-grab can orphan the reference and leave a ghost leash
      document.getElementById("cd-leash")?.remove();
      leashSvg = null;
      strainSince = 0;
      pet.classList.remove("cd-walking", "cd-stubborn");
    }

    function breakLeash() {
      cleanupLeash();
      state.mode = "idle";
      state.anchor = { x: state.x, y: state.y, until: Date.now() + ANCHOR_MS };
      persist();
      oneShot("cd-idle-shake", 1500, null);
    }

    function follow(now) {
      if (!following) return;
      const dt = last ? now - last : 16; last = now;
      const cx = state.x + SIZE / 2;
      const cy = collarClientY();
      const dx = handle.x - cx, dy = handle.y - cy;
      const dist = Math.hypot(dx, dy);
      const badMood = state.mood === "sad" || state.mood === "hungry";

      // strain only counts while he is not catching up, so fast mouse movement alone never snaps it
      const closing = dist < prevDist - 0.02 * dt;
      if (dist > MAX_PULL && !closing) {
        if (!strainSince) strainSince = now;
        leashPath.setAttribute("stroke", "#A93B31");
        if (now - strainSince > 900) return breakLeash();
      } else if (strainSince) {
        strainSince = 0;
        leashPath.setAttribute("stroke", "#E2574C");
      }
      prevDist = dist;

      // a treat within reach ends the walk
      if (treatNearby(130)) {
        cleanupLeash();
        state.mode = "idle";
        persist();
        return seekDropped();
      }

      if (dist > LEASH_LEN) {
        if (badMood && now > nextStubbornCheck && now > stubbornUntil) {
          nextStubbornCheck = now + 3500 + Math.random() * 4500;
          if (Math.random() < 0.55) {
            stubbornUntil = now + 900 + Math.random() * 900;
            pet.classList.remove("cd-walking");
            pet.classList.add("cd-stubborn");
          }
        }
        if (now < stubbornUntil) {
          drawLeash();
          leashRaf = requestAnimationFrame(follow);
          return;
        }
        pet.classList.remove("cd-stubborn");
        const pull = dist - LEASH_LEN;
        const moodMul = state.mood === "content" ? 1.12 : badMood ? 0.5 : 1;
        const sprint = dist > MAX_PULL ? 1.7 : 1;
        const speed = Math.min(0.05 + pull * 0.004, 0.3) * moodMul * sprint;
        state.dir = dx > 0 ? 1 : -1;
        facing();
        pet.classList.add("cd-walking");
        setPos(state.x + (dx / dist) * speed * dt, state.y - (dy / dist) * speed * dt);
        leashVel.x = (dx / dist) * speed; leashVel.y = -(dy / dist) * speed;
      } else {
        pet.classList.remove("cd-walking", "cd-stubborn");
        leashVel.x = 0; leashVel.y = 0;
      }
      drawLeash();
      leashRaf = requestAnimationFrame(follow);
    }

    let dragPending = null; // pointerdown seen, drag intent not yet confirmed

    function beginLeash() {
      interrupt();
      wake();
      clearOneShotClasses();
      state.mode = "drag";
      following = true; last = 0;
      strainSince = 0; prevDist = Infinity;
      leashSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      leashSvg.id = "cd-leash";
      leashSvg.style.cssText = "position:fixed; inset:0; width:100vw; height:100vh; z-index:2147483645; pointer-events:none;";
      leashPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      leashPath.setAttribute("stroke", "#E2574C");
      leashPath.setAttribute("stroke-width", "3");
      leashPath.setAttribute("stroke-linecap", "round");
      leashPath.setAttribute("fill", "none");
      const loop = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      loop.setAttribute("r", "5");
      loop.setAttribute("fill", "none");
      loop.setAttribute("stroke", "#E2574C");
      loop.setAttribute("stroke-width", "3");
      leashSvg.append(leashPath, loop);
      document.body.appendChild(leashSvg);
      const syncLoop = () => { loop.setAttribute("cx", handle.x); loop.setAttribute("cy", handle.y); };
      syncLoop();
      leashSvg._syncLoop = syncLoop;
      drawLeash();
      leashRaf = requestAnimationFrame(follow);
    }

    pet.addEventListener("pointerdown", (e) => {
      if (e.button === 0 && hasProp() && pet.dataset.prop !== "off" && e.target.closest?.(".cd-prop")) { e.stopPropagation(); e.preventDefault(); tossProp(); return; }
      cleanupLeash();
      dragPending = { x: e.clientX, y: e.clientY };
      movedFar = false;
      handle = { x: e.clientX, y: e.clientY };
      pet.setPointerCapture(e.pointerId);
    });

    pet.addEventListener("pointermove", (e) => {
      if (dragPending) {
        // a tap must not interrupt him; drag intent needs 7px of movement
        if (Math.hypot(e.clientX - dragPending.x, e.clientY - dragPending.y) > 7) {
          dragPending = null;
          movedFar = true;
          handle = { x: e.clientX, y: e.clientY };
          beginLeash();
        }
        return;
      }
      if (state.mode !== "drag") return;
      handle = { x: e.clientX, y: e.clientY };
      leashSvg?._syncLoop?.();
    });

    function glideOut() {
      if (Math.hypot(leashVel.x, leashVel.y) < 0.012) return scheduleTick();
      const v = { x: leashVel.x, y: leashVel.y };
      state.mode = "walk";
      pet.classList.add("cd-walking");
      let vlast = performance.now();
      const decay = (now) => {
        if (state.mode !== "walk") return;
        const dt = now - vlast; vlast = now;
        const k = Math.pow(0.994, dt);
        v.x *= k; v.y *= k;
        setPos(state.x + v.x * dt, state.y + v.y * dt);
        if (Math.hypot(v.x, v.y) > 0.008) { state.raf = requestAnimationFrame(decay); return; }
        pet.classList.remove("cd-walking");
        state.mode = "idle";
        state.anchor = { x: state.x, y: state.y, until: Date.now() + ANCHOR_MS };
        persist();
        scheduleTick();
      };
      state.raf = requestAnimationFrame(decay);
    }

    pet.addEventListener("pointerup", () => {
      if (dragPending) {
        // a tap: nothing was interrupted, so react only if free
        dragPending = null;
        if (state.mood === "sleeping") return;
        if (state.resting) return wake();
        if (state.mode === "oneshot" || state.mode === "drag") { maybeHeart(0.06); return; }
        interrupt();
        state.mode = "idle";
        return patReaction();
      }
      if (state.mode !== "drag") return;
      cleanupLeash();
      state.mode = "idle";
      persist();
      if (!movedFar && state.mood !== "sleeping") return patReaction();
      if (onBed()) {
        if (Math.random() < 1 / 3) return rest();
        const s = bedSpot();
        setPos(s.x, s.y);
        state.anchor = { x: s.x, y: s.y, until: Date.now() + ANCHOR_MS };
        return oneShot("cd-idle-sit", IDLE_MS.sit, null);
      }
      state.anchor = { x: state.x, y: state.y, until: Date.now() + ANCHOR_MS };
      glideOut();
    });

    // drags can end without a pointerup: gesture steals, window blur, capture loss
    for (const evt of ["pointercancel", "lostpointercapture"]) {
      pet.addEventListener(evt, () => {
        dragPending = null;
        if (state.mode !== "drag") return;
        cleanupLeash();
        state.mode = "idle";
        persist();
        scheduleTick();
      });
    }
  }

  // ---------- bed dragging ----------

  function enableBedDrag() {
    let sx = 0, sy = 0, bx = 0, by = 0, dragging = false;
    bedEl.addEventListener("pointerdown", (e) => {
      dragging = true;
      bedEl.style.cursor = "grabbing";
      sx = e.clientX; sy = e.clientY; bx = state.bed.x; by = state.bed.y;
      bedEl.setPointerCapture(e.pointerId);
    });
    bedEl.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      state.bed.x = Math.min(Math.max(0, bx + e.clientX - sx), window.innerWidth - BED_W - 4);
      state.bed.y = Math.min(Math.max(0, by - (e.clientY - sy)), window.innerHeight - 140);
      syncBedPos();
      if (state.resting) { const s = bedSpot(); setPos(s.x, s.y); } // the pet rides the bed
    });
    bedEl.addEventListener("pointerup", async () => {
      if (!dragging) return;
      dragging = false;
      bedEl.style.cursor = "grab";
      try { await chrome.storage.local.set({ bed_x: state.bed.x, bed_y: state.bed.y }); } catch {}
    });
  }

  // ---------- treats: armed in the popup, carried on the cursor, dropped on click ----------
  // the popup closes on blur, so it cannot drag into the page; arming plus a cursor carry is the hand-off

  const TREAT_SHAPES = `<circle cx="6.4" cy="10.6" r="3.1"/><circle cx="6.4" cy="15.4" r="3.1"/><circle cx="19.6" cy="10.6" r="3.1"/><circle cx="19.6" cy="15.4" r="3.1"/><rect x="6.4" y="10.4" width="13.2" height="5.2" rx="2.6"/>`;
  const TREAT_SVG = {
    plain: `<g fill="#8A5426" stroke="#8A5426" stroke-width="2.6" stroke-linejoin="round">${TREAT_SHAPES}</g><g fill="#EEDAC4">${TREAT_SHAPES}</g>`,
    rare: `<g fill="#9A6B14" stroke="#9A6B14" stroke-width="2.6" stroke-linejoin="round">${TREAT_SHAPES}</g><g fill="#E9B44C">${TREAT_SHAPES}</g><circle cx="13" cy="6.6" r="1.3" fill="#FFF6DC"/><circle cx="21.5" cy="18.6" r="1" fill="#FFF6DC"/>`,
    tangerine: `<circle cx="13" cy="14.5" r="9.5" fill="#F28C28" stroke="#3E1E0C" stroke-width="2"/><ellipse cx="9.5" cy="11" rx="2.6" ry="1.6" fill="#FFC27A" opacity=".85"/><path d="M13.5 5.5 Q17 1.5 21 3.5 Q17.5 7 14 6.5 Z" fill="#5FA85A" stroke="#3E1E0C" stroke-width="1.6" stroke-linejoin="round"/>`,
  };
  let carry = null;

  const CARRY_MS = 60000; // an undropped carry expires and returns to the shelf

  function cancelCarry() {
    if (!carry) return;
    window.removeEventListener("pointermove", carry.onMove, true);
    window.removeEventListener("click", carry.onClick, true);
    window.removeEventListener("keydown", carry.onKey, true);
    window.removeEventListener("contextmenu", carry.onCtx, true);
    clearTimeout(carry.timer);
    carry.el.remove();
    carry.tip?.remove();
    carry = null;
  }

  // nothing is spent until a drop, so returning just clears the arm; onChanged then cancels the carry in every other tab
  function returnTreat() {
    cancelCarry();
    chrome.storage.local.remove("cd_treat_armed").catch(() => {});
  }

  function startCarry(kind) {
    cancelCarry();
    const el = document.createElement("div");
    el.style.cssText = `position: fixed; width: 30px; height: 30px; z-index: 2147483647;
      pointer-events: none; filter: drop-shadow(0 2px 3px rgba(0,0,0,.25));
      left: ${state.lastCursor.x - 15}px; top: ${state.lastCursor.y - 15}px;`;
    el.innerHTML = `<svg viewBox="0 0 26 26" width="30" height="30">${TREAT_SVG[kind]}</svg>`;
    document.body.appendChild(el);
    const tip = document.createElement("div");
    tip.textContent = "click to drop";
    tip.style.cssText = `position: fixed; z-index: 2147483647; pointer-events: none; white-space: nowrap;
      background: #1c1c1e; color: #f2f2f2; border-radius: 8px; padding: 4px 8px;
      font: 600 11px/1.3 -apple-system, sans-serif; opacity: .92; transition: opacity .4s;
      left: ${state.lastCursor.x + 18}px; top: ${state.lastCursor.y + 18}px;`;
    document.body.appendChild(tip);
    setTimeout(() => { tip.style.opacity = "0"; setTimeout(() => tip.remove(), 450); }, 2600);
    const onMove = (e) => {
      el.style.left = e.clientX - 15 + "px"; el.style.top = e.clientY - 15 + "px";
      if (tip.isConnected) { tip.style.left = e.clientX + 18 + "px"; tip.style.top = e.clientY + 18 + "px"; }
    };
    const onClick = (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      dropTreat(kind, el, e.clientX, e.clientY);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.preventDefault(); returnTreat(); } };
    const onCtx = (e) => { e.preventDefault(); returnTreat(); };
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("click", onClick, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("contextmenu", onCtx, true);
    const timer = setTimeout(returnTreat, CARRY_MS);
    carry = { kind, el, tip, onMove, onClick, onKey, onCtx, timer };
  }

  // ---------- free box drop ----------
  const BOX_SVG = `<svg viewBox="0 0 64 64" width="44" height="44"><rect x="8" y="26" width="48" height="32" rx="5" fill="#E8534A" stroke="#3E1E0C" stroke-width="3"/><rect x="5" y="18" width="54" height="12" rx="4" fill="#F26B62" stroke="#3E1E0C" stroke-width="3"/><rect x="28" y="18" width="8" height="40" fill="#F6C13C" stroke="#3E1E0C" stroke-width="2.5"/><path d="M32 18c-6-2-12-10-6-13 4-2 7 5 6 13zm0 0c6-2 12-10 6-13-4-2-7 5-6 13z" fill="#F6C13C" stroke="#3E1E0C" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
  let box = null;
  function spawnBox(at) {
    box?.el?.remove();
    const x = at && Number.isFinite(at.x) ? at.x : Math.min(window.innerWidth - 80, state.x + SIZE + 120);
    const yLand = at && Number.isFinite(at.y) ? Math.min(at.y + 40, window.innerHeight - 40) : window.innerHeight - 40;
    const el = document.createElement("div");
    el.style.cssText = `position: fixed; width: 44px; height: 44px; z-index: 2147483647; pointer-events: none;
      filter: drop-shadow(0 4px 6px rgba(0,0,0,.28)); left: ${x - 22}px; top: ${yLand - 22}px;`;
    el.innerHTML = BOX_SVG;
    document.body.appendChild(el);
    el.animate([
      { transform: "translateY(-140px) scale(.6) rotate(-14deg)", opacity: 0 },
      { transform: "translateY(0) scale(1.08) rotate(4deg)", opacity: 1, offset: .55 },
      { transform: "translateY(-18px) scale(.98) rotate(-3deg)", offset: .75 },
      { transform: "translateY(0) scale(1) rotate(0)", opacity: 1 },
    ], { duration: 820, easing: "cubic-bezier(.2,.9,.3,1.1)", fill: "forwards" });
    box = { x, y: yLand, el };
    setTimeout(() => {
      if (box?.el !== el) return;
      const tx = clampX(x - SIZE / 2), ty = clampY(window.innerHeight - yLand - SIZE * 0.55);
      wake(); interrupt(); clearOneShotClasses();
      moveTo(tx, ty, { scurry: true, then: collectBox });
    }, 700);
  }
  function collectBox() {
    const b = box; if (!b) return; box = null;
    const r = b.el.getBoundingClientRect();
    const dx = window.innerWidth - 40 - r.left, dy = 12 - r.top;
    emitMotes("heart", { count: 5, slow: true });
    happyJump();
    b.el.animate([
      { transform: "translate(0,0) scale(1)", opacity: 1 },
      { transform: "translate(0,-26px) scale(1.15)", opacity: 1, offset: .25 },
      { transform: `translate(${dx}px,${dy}px) scale(.35)`, opacity: .9 },
    ], { duration: 900, easing: "cubic-bezier(.4,0,.2,1)", fill: "forwards" }).onfinish = () => b.el.remove();
  }
  document.addEventListener("cd-box", (e) => { if (!document.getElementById("cd-pet")) return; spawnBox(e.detail?.at ?? null); });

  let dropped = null; // { kind, x, y (client coords), el }; persisted across reloads

  function placeTreat(kind, x, y, save = true) {
    dropped?.el?.remove();
    const el = document.createElement("div");
    el.style.cssText = `position: fixed; width: 30px; height: 30px; z-index: 2147483647;
      pointer-events: none; filter: drop-shadow(0 2px 3px rgba(0,0,0,.25));
      left: ${x - 15}px; top: ${y - 15}px;`;
    el.innerHTML = `<svg viewBox="0 0 26 26" width="30" height="30">${TREAT_SVG[kind]}</svg>`;
    document.body.appendChild(el);
    dropped = { kind, x, y, el };
    if (save) chrome.storage.local.set({ cd_treat_dropped: { kind, x, y, ts: Date.now() } }).catch(() => {});
  }

  function seekDropped() {
    if (!dropped) return;
    const { kind, x, y } = dropped;
    const tx = clampX(x - SIZE / 2);
    const ty = clampY(window.innerHeight - y - SIZE * 0.55);
    wake(); interrupt(); clearOneShotClasses();
    const far = Math.hypot(tx - state.x, ty - state.y) > 260;
    moveTo(tx, ty, { scurry: far, turbo: kind === "rare", then: () => devour(kind) });
  }

  function treatNearby(radius) {
    if (!dropped) return false;
    const px = state.x + SIZE / 2, py = window.innerHeight - state.y - SIZE / 2;
    return Math.hypot(dropped.x - px, dropped.y - py) < radius;
  }

  async function dropTreat(kind, el, x, y) {
    window.removeEventListener("pointermove", carry.onMove, true);
    window.removeEventListener("click", carry.onClick, true);
    el.remove();
    carry = null;
    try {
      await chrome.storage.local.remove("cd_treat_armed");
      const { cd_treats } = await chrome.storage.local.get("cd_treats");
      const t = cd_treats ?? { plain: 0, rare: 0 };
      t[kind] = Math.max(0, (t[kind] ?? 0) - 1);
      await chrome.storage.local.set({ cd_treats: t });
    } catch {}
    placeTreat(kind, x, y);
    seekDropped();
  }

  function devour(kind) {
    const el = dropped?.el;
    dropped = null;
    chrome.storage.local.remove("cd_treat_dropped").catch(() => {});
    if (el) {
      el.style.transition = "transform .28s ease";
      setTimeout(() => { el.style.transform = "scale(.72)"; }, 250);
      setTimeout(() => { el.style.transform = "scale(.42)"; }, 620);
      setTimeout(() => el.remove(), 980);
    }
    // moodGlowUntil suppresses the Canvas-state mood resync for a while
    const cheer = () => {
      state.moodGlowUntil = Date.now() + (kind === "rare" ? 10 : 3) * 60000;
      if (state.mood === "sad" || state.mood === "hungry") setMood("content");
    };
    oneShot("cd-eating", 1250, "open", () => {
      cheer();
      if (kind === "rare") {
        // sugar rush: 15s of hearts and zoomies
        const until = Date.now() + 15000;
        const heartLoop = setInterval(() => {
          if (document.hidden) return;
          emitMotes("heart", { count: 2, slow: true });
        }, 850);
        setTimeout(() => clearInterval(heartLoop), 15200);
        pet.classList.add("cd-ultra");
        setTimeout(() => pet.classList.remove("cd-ultra"), 2400);
        const zoom = () => {
          if (Date.now() > until || state.mode === "drag") return scheduleTick();
          moveTo(clampX(20 + Math.random() * (window.innerWidth - SIZE - 40)), FLOOR,
            { turbo: true, then: zoom });
        };
        setTimeout(zoom, 2500);
      } else {
        emitMotes("heart", { count: 6, slow: true });
        happyJump();
      }
    });
  }

  chrome.storage.onChanged.addListener((ch) => {
    if (!ch.cd_treat_armed || !pet) return;
    const v = ch.cd_treat_armed.newValue;
    if (!v) return cancelCarry();
    if (Date.now() - (v.ts ?? 0) > CARRY_MS) return; // stale arm
    startCarry(v.kind === "rare" ? "rare" : "plain");
  });

  // ---------- naming, greeting, ping ----------

  async function maybeAskName() {
    try {
      const { pet_name } = await chrome.storage.local.get("pet_name");
      if (pet_name) { pet.title = pet_name; return true; }
      // naming happens in the popup; the page shows the species default until then
      pet.title = ({ pup: "Puppy", cat: "Kitten" })[species] ?? "Puppy";
      return false;
      const box = document.createElement("div");
      box.style.cssText = `
        position: fixed; z-index: 2147483647; left: ${clampX(state.x - 30)}px;
        bottom: ${state.y + SIZE + 12}px; background: #fff; color: #2D3B45;
        border: 1.5px solid #D5DDE4; border-radius: 12px; padding: 10px 12px;
        font: 600 12.5px/1.4 'Lato', -apple-system, sans-serif;
        box-shadow: 0 4px 14px rgba(0,0,0,.15); display: flex; gap: 7px; align-items: center;`;
      const label = document.createElement("span");
      label.textContent = "Your new study buddy! Name them:";
      const input = document.createElement("input");
      input.maxLength = 20;
      input.placeholder = "Miso";
      input.style.cssText = "width: 90px; border: 1px solid #C7CDD1; border-radius: 7px; padding: 4px 7px; font: inherit;";
      const ok = document.createElement("button");
      ok.textContent = "✓";
      ok.style.cssText = "background: #2B7ABC; color: #fff; border: none; border-radius: 7px; padding: 4px 10px; cursor: pointer; font: inherit;";
      const save = async () => {
        const name = input.value.trim() || "Miso";
        await chrome.storage.local.set({ pet_name: name });
        pet.title = name;
        box.remove();
        emote("heart");
        happyJump();
      };
      ok.onclick = save;
      input.onkeydown = (e) => { if (e.key === "Enter") save(); };
      box.append(label, input, ok);
      document.body.appendChild(box);
      return false;
    } catch { return true; }
  }

  async function maybeGreet() {
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const { last_greet } = await chrome.storage.local.get("last_greet");
      if (last_greet === today) return;
      await chrome.storage.local.set({ last_greet: today });
      setTimeout(() => {
        if (state.mode === "drag") return;
        wake();
        oneShot("cd-idle-stretch", IDLE_MS.stretch, null, () => {
          const target = clampX(window.innerWidth / 2 - SIZE / 2 + (Math.random() * 200 - 100));
          moveTo(target, FLOOR, { then: () => { emote("heart"); happyJump(); } });
        });
      }, 1200);
    } catch {}
  }

  function schedulePing() {
    if (state.pinged) return;
    setTimeout(() => {
      const eligible =
        !state.pinged && state.attention === "chill" && state.mode === "idle" &&
        !state.resting && !document.hidden && Date.now() - state.lastInput < 60000;
      if (!eligible) return schedulePing();
      state.pinged = true;
      const c = state.lastCursor;
      moveTo(clampX(c.x - SIZE / 2), clampY(Math.min(window.innerHeight - c.y - SIZE - 20, window.innerHeight * 0.45)), {
        then: () => oneShot("cd-idle-look", IDLE_MS.look, null, () => { maybeHeart(); happyJump(); }),
      });
    }, 200000 + Math.random() * 260000);
  }

  const OVERDUE_WINDOW_DAYS = 45;

  async function fetchOverdueCount() {
    try {
      const cached = await chrome.storage.local.get(["overdue_count", "overdue_checked_at"]);
      if (cached.overdue_checked_at && Date.now() - cached.overdue_checked_at < 6 * 3600 * 1000) {
        return cached.overdue_count ?? 0;
      }
      let raw;
      try { raw = await netCanvasJson("/api/v1/users/self/missing_submissions?per_page=50"); } catch { return 0; }
      const cutoff = Date.now() - OVERDUE_WINDOW_DAYS * 24 * 3600 * 1000;
      const count = raw.filter((a) => a.due_at && Date.parse(a.due_at) > cutoff).length;
      await chrome.storage.local.set({ overdue_count: count, overdue_checked_at: Date.now() });
      return count;
    } catch { return 0; }
  }

  async function daysSinceLastVisit() {
    try {
      const { last_visit } = await chrome.storage.local.get("last_visit");
      const gap = last_visit ? (Date.now() - last_visit) / (24 * 3600 * 1000) : 0;
      await chrome.storage.local.set({ last_visit: Date.now() });
      return gap;
    } catch { return 0; }
  }

  let nightSleep = true; // Settings toggle "Pet sleeps at night"
  chrome.storage.local.get("night_sleep").then(({ night_sleep }) => { nightSleep = night_sleep !== false; }).catch(() => {});
  chrome.storage.onChanged.addListener((ch) => {
    if (!ch.night_sleep) return;
    nightSleep = ch.night_sleep.newValue !== false;
    computeMood().then((m) => { if (pet && m !== state.mood) { setMood(m); if (m !== "sleeping") scheduleTick(); } }).catch(() => {});
  });
  const isNight = () => { if (!nightSleep) return false; const h = new Date().getHours(); return h >= 23 || h < 7; };

  async function computeMood() {
    const overdue = await fetchOverdueCount();
    const gap = await daysSinceLastVisit();
    if (overdue > 0) return "sad";
    if (gap >= 2) return "hungry";
    if (isNight()) return "sleeping";
    return "content";
  }

  const onQuizPage = () => /\/quizzes\/\d+\/take|\/courses\/\d+\/assignments\/\d+\/take/.test(location.pathname);

  // ---------- wiring ----------

  function teardown() {
    stopCollarMotes(); stopCollarMotes = () => {};
    document.querySelectorAll(".cd-cmote").forEach((m) => m.remove());
    interrupt();
    clearTimeout(state.tickTimer);
    state.resting = false;
    state.mode = "idle";
    for (const id of ["cd-pet", "cd-pet-bed", "cd-pet-bed-front", "cd-leash"]) {
      document.getElementById(id)?.remove();
    }
    log("pet hidden");
  }

  // the popup's switch, obeyed live; adoption walks him in
  chrome.storage.onChanged.addListener((ch) => {
    if (ch.cd_econ && ch.cd_econ.newValue?.adopted && !ch.cd_econ.oldValue?.adopted && !document.getElementById("cd-pet")) init({ entrance: true });
    if (!ch.pet_enabled) return;
    if (ch.pet_enabled.newValue === false) teardown();
    else if (!document.getElementById("cd-pet")) init();
  });

  // fallback when the collar engine is not loaded; mirrors COLLARS in popup.js, keep both in sync
  const COLLAR_COLORS = { coral: "#CD5A4E", sky: "#2B7ABC", mint: "#2FA97E", lilac: "#9B7FD4", sunset: "#F08A3E", forest: "#2E7D5B",
    berry: "#B0306E", midnight: "#243B6B", rose: "#E58FA6", aurora: "#6ED3C8", gold: "#E2A93B", scroll: "#15120F" };
  let fxCss = false, stopCollarMotes = () => {};
  async function applyEquipped() {
    try {
      const { cd_econ } = await chrome.storage.local.get("cd_econ");
      const key = cd_econ?.equipped?.collar;
      if (!key || !pet) return; // nothing equipped: keep the art's native collar
      // collar-engine.js (shared with the popup) applies patterns, gradients and effects
      if (typeof applyCollarDef === "function" && typeof COLLAR_DEFS !== "undefined") {
        if (!fxCss) { const st = document.createElement("style"); st.textContent = COLLAR_FX_CSS; document.documentElement.appendChild(st); fxCss = true; }
        const def = COLLAR_DEFS.find((d) => d.id === key);
        const svg = pet.querySelector("svg");
        if (def && svg) {
          applyCollarDef(svg, def, "page");
          stopCollarMotes();
          stopCollarMotes = collarMoteLoop(def, document.body, () => {
            if (!pet || !pet.isConnected) return null;
            return { x: state.x, y: window.innerHeight - state.y - SIZE, w: SIZE, h: SIZE, dir: state.dir, moving: state.mode === "walk" };
          }, true);
          return;
        }
      }
      const color = COLLAR_COLORS[key] ?? COLLAR_COLORS.coral;
      pet.querySelectorAll(".cd-collar").forEach((el) => {
        const f = el.getAttribute("fill");
        if (f && f !== "none") el.setAttribute("fill", color); else el.setAttribute("stroke", color);
      });
    } catch {}
  }
  chrome.storage.onChanged.addListener((ch) => {
    if (!ch.cd_econ) return;
    if (pet && speciesFor(ch.cd_econ.newValue?.equipped?.animal) !== species) loadImportArt();
    else applyEquipped();
  });

  // page-dispatchable debug bridge, toggles visibility only
  document.addEventListener("cd-pet-toggle", (e) => {
    const on = e.detail?.on !== false;
    chrome.storage.local.set({ pet_enabled: on }).catch(() => {});
  });

  async function init({ entrance = false } = {}) {
    if (document.getElementById("cd-pet")) return;
    try {
      const { pet_enabled, cd_econ } = await chrome.storage.local.get(["pet_enabled", "cd_econ"]);
      if (pet_enabled === false) { log("pet disabled by switch"); return; }
      if (!cd_econ?.adopted) { log("waiting for adoption"); return; }
    } catch {}
    pet = buildRig();
    IDLES = (pet.dataset.idles ?? "").split(",").filter(Boolean);
    if (BED_ENABLED) {
      bedEl = buildBed();
      bedFrontEl = buildBedFront();
      document.body.append(bedEl, pet, bedFrontEl);
    } else {
      document.body.append(pet);
    }
    try {
      const { bed_x, bed_y, pet_state } = await chrome.storage.local.get(["bed_x", "bed_y", "pet_state"]);
      if (typeof bed_x === "number") state.bed = { x: bed_x, y: bed_y ?? 0 };
      syncBedPos();
      // resume a recent position so page loads do not teleport him home
      if (entrance) {
        setPos((window.innerWidth - SIZE) / 2, Math.max(FLOOR, (window.innerHeight - SIZE) / 2));
      } else if (pet_state && Date.now() - (pet_state.saved_at ?? 0) < 30 * 60 * 1000) {
        state.dir = pet_state.dir ?? 1;
        if (pet_state.anchor) state.anchor = pet_state.anchor;
        if (pet_state.propUntil) state.propUntil = pet_state.propUntil;
        if (pet_state.home) state.home = { x: clampX(pet_state.home.x), y: clampY(pet_state.home.y) };
        if (pet_state.resting && BED_ENABLED) rest();
        else if (pet_state.resting) { const s = bedSpot(); setPos(s.x, s.y); }
        else setPos(pet_state.x ?? bedSpot().x, pet_state.y ?? bedSpot().y);
      } else {
        const s = bedSpot();
        setPos(s.x, s.y);
      }
    } catch { const s = bedSpot(); setPos(s.x, s.y); }
    facing();
    requestAnimationFrame(() => {
      pet.style.opacity = "1";
      if (bedEl) bedEl.style.opacity = "1";
      if (bedFrontEl) bedFrontEl.style.opacity = "1";
    });
    loadImportArt();
    enableLeash();
    if (BED_ENABLED) enableBedDrag();
    applyEquipped();
    setMood(await computeMood());

    if (onQuizPage()) {
      state.attention = "dnd";
      setPos(window.innerWidth - SIZE - 16, FLOOR);
      log("pet alive (dnd — quiz page)");
      return;
    }
    if (entrance) {
      // reset the AFK clock so he stays calm through the entrance
      state.lastInput = Date.now();
      pet.classList.add("cd-arrive");
      setTimeout(() => { emitMotes("heart", { count: 8, slow: true }); happyJump(); }, 1400);
      setTimeout(() => { pet.classList.remove("cd-arrive"); scheduleTick(); }, 3200);
    } else {
      scheduleTick();
    }

    if (state.wired) { log("pet re-enabled", { mood: state.mood }); return; }
    state.wired = true; // loops and global listeners register exactly once
    scheduleBlink();
    scheduleEmotes();
    /* @strip:visits */ if (VISITS) scheduleVisit(true); /* @/strip:visits */
    chrome.storage.local.get(["cd_treat_armed", "cd_treat_dropped"]).then(({ cd_treat_armed: v, cd_treat_dropped: d }) => {
      if (v && Date.now() - (v.ts ?? 0) < CARRY_MS) startCarry(v.kind === "rare" ? "rare" : "plain");
      if (d && TREAT_SVG[d.kind]) {
        placeTreat(d.kind, Math.min(d.x, window.innerWidth - 20), Math.min(d.y, window.innerHeight - 20), false);
        setTimeout(() => seekDropped(), 1500 + Math.random() * 1500);
      }
    }).catch(() => {});

    for (const evt of ["pointermove", "pointerdown", "keydown", "wheel", "scroll"]) {
      window.addEventListener(evt, noteInput, { passive: true, capture: true });
    }
    window.addEventListener("pointermove", (e) => {
      state.lastCursor = { x: e.clientX, y: e.clientY };
    }, { passive: true, capture: true });
    updateInterest();
    scheduleGlances();
    gazeLoop();

    const alreadyNamed = await maybeAskName();
    if (alreadyNamed) maybeGreet();
    schedulePing();

    document.addEventListener("cd-streak", (e) => {
      const d = e.detail ?? {};
      if (d.milestone) { wake(); ultraCelebrate(); }
      else if (d.extendedNow) { wake(); happyJump(); }
    });

    document.addEventListener("cd-completion", (e) => {
      wake();
      const title = (e.detail?.title ?? "").toLowerCase();
      const big = /exam|midterm|final\b|project|paper|essay|presentation/.test(title);
      chrome.storage.local.remove("overdue_checked_at").then(() =>
        Date.now() < (state.moodGlowUntil ?? 0)
          ? null // treat glow holds the mood
          : computeMood().then((m) => { if (m !== state.mood) setMood(m); })
      );
      big ? ultraCelebrate() : eat();
    });

    // ---------- resync ----------
    // "sleeping" switches the scheduler off, so mood is recomputed on tab return, after system sleep, and periodically
    let lastBeat = Date.now();
    async function resync(reason) {
      syncProp();
      if (state.mode === "drag") return;
      // the viewport may have changed shape
      if (window.innerWidth > 300 && window.innerHeight > 200) setPos(state.x, state.y);
      const glowing = Date.now() < (state.moodGlowUntil ?? 0);
      const m = glowing ? state.mood : await computeMood();
      const wasAsleep = state.mood === "sleeping";
      if (m !== state.mood) setMood(m);
      if (!state.resting && state.mode !== "walk" && state.mode !== "oneshot") {
        state.mode = "idle";
        if (m !== "sleeping") scheduleTick();
      }
      if (wasAsleep && m !== "sleeping") log("resync: woke up", reason);
    }
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) interrupt();
      else resync("tab visible");
    });
    setInterval(() => {
      const now = Date.now();
      const gap = now - lastBeat;
      lastBeat = now;
      if (gap > 3 * 60000) { if (!document.hidden) resync("system sleep"); return; } // timers stalled: the machine slept
      if (now % (10 * 60000) < 60000 && !document.hidden) resync("periodic"); // about every 10 min
    }, 60000);
    // a closing lid can report a degenerate viewport for a moment; never clamp on that
    window.addEventListener("resize", () => { if (window.innerWidth > 300 && window.innerHeight > 200) setPos(state.x, state.y); });
    setInterval(() => { if (state.mode === "idle" || state.mode === "rest") persist(); }, 9000);
    log("pet alive", { mood: state.mood });
  }

  init();
})();
