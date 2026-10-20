"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize, Minimize, Pause, Play, Volume2, VolumeX } from "lucide-react";

const SPEEDS = [1, 1.25, 1.5, 2, 0.75];

export function clock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = String(whole % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

/**
 * Uddeepto's own video player (the browser's built-in controls are switched off).
 *
 *   src            the video address
 *   videoRef       optional ref to reach the <video> element
 *   limit          0-1: the furthest point (as a share of the length) the viewer may seek or play to, or null for no limit
 *   markers        [{ at: 0-1, done: boolean }] ticks drawn on the progress bar
 *   children       drawn over the video (also in full screen), for example a question panel
 *   onPlay / onTimeUpdate / onSeeking / onEnded   forwarded video events
 */
export default function VideoPlayer({ src, videoRef, limit = null, markers = [], children, onPlay, onTimeUpdate, onSeeking, onEnded, label = "Video" }) {
  const own = useRef(null);
  const video = videoRef || own;
  const shell = useRef(null);
  const idleTimer = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);
  const [full, setFull] = useState(false);
  const [idle, setIdle] = useState(false);
  const [failed, setFailed] = useState(false);

  const furthest = useCallback(() => {
    const total = video.current?.duration;
    if (!Number.isFinite(total) || total <= 0) return 0;
    return limit == null ? total : Math.min(total, total * limit);
  }, [limit, video]);

  const seek = useCallback(
    (to) => {
      const element = video.current;
      if (!element || !Number.isFinite(element.duration)) return;
      element.currentTime = Math.max(0, Math.min(to, furthest()));
    },
    [furthest, video],
  );

  const toggle = useCallback(() => {
    const element = video.current;
    if (!element) return;
    if (element.paused) element.play().catch(() => {});
    else element.pause();
  }, [video]);

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else shell.current?.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === shell.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => () => clearTimeout(idleTimer.current), []);

  function wake() {
    setIdle(false);
    clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => setIdle(true), 2800);
  }

  function onKeyDown(event) {
    const target = event.target;
    if (target.closest?.(".vp-overlay")) return; // typing or choosing in the question panel
    const tag = target.tagName;
    if (tag === "BUTTON" && (event.key === " " || event.key === "Enter")) return;
    const element = video.current;
    if (!element) return;
    const key = event.key.toLowerCase();
    if ((key === " " || key === "k") && tag !== "INPUT") toggle();
    else if (key === "arrowleft" && tag !== "INPUT") seek(element.currentTime - 5);
    else if (key === "arrowright" && tag !== "INPUT") seek(element.currentTime + 5);
    else if (key === "arrowup" && tag !== "INPUT") element.volume = Math.min(1, element.volume + 0.1);
    else if (key === "arrowdown" && tag !== "INPUT") element.volume = Math.max(0, element.volume - 0.1);
    else if (key === "m") element.muted = !element.muted;
    else if (key === "f") toggleFull();
    else return;
    event.preventDefault();
    wake();
  }

  const share = duration ? Math.min(100, (time / duration) * 100) : 0;
  const lockedFrom = limit == null ? 100 : limit * 100;

  return (
    <div
      ref={shell}
      className={`vp${full ? " full" : ""}${playing && idle ? " idle" : ""}`}
      onMouseMove={wake}
      onKeyDown={onKeyDown}
      aria-label={label}
    >
      <div className="vp-stage" tabIndex={0} onClick={toggle} role="button" aria-label={playing ? "Pause video" : "Play video"}>
        <video
          ref={video}
          src={src}
          preload="metadata"
          playsInline
          disablePictureInPicture
          disableRemotePlayback
          onContextMenu={(event) => event.preventDefault()}
          onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
          onDurationChange={(event) => setDuration(event.currentTarget.duration)}
          onPlay={(event) => {
            setPlaying(true);
            wake();
            onPlay?.(event);
          }}
          onPause={() => setPlaying(false)}
          onTimeUpdate={(event) => {
            setTime(event.currentTarget.currentTime);
            onTimeUpdate?.(event);
          }}
          onSeeking={(event) => {
            setTime(event.currentTarget.currentTime);
            onSeeking?.(event);
          }}
          onEnded={(event) => {
            setPlaying(false);
            setIdle(false);
            onEnded?.(event);
          }}
          onVolumeChange={(event) => {
            setVolume(event.currentTarget.volume);
            setMuted(event.currentTarget.muted);
          }}
          onRateChange={(event) => setRate(event.currentTarget.playbackRate)}
          onError={() => setFailed(true)}
        />
        {failed && <p className="vp-error">This video could not be played.</p>}
        {!playing && !failed && (
          <span className="vp-big" aria-hidden="true">
            <Play size={30} fill="currentColor" />
          </span>
        )}
      </div>

      <div className="vp-controls">
        <button type="button" className="vp-btn" onClick={toggle} aria-label={playing ? "Pause" : "Play"}>
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>
        <span className="vp-time" aria-label="Elapsed and total time">
          {clock(time)} / {clock(duration)}
        </span>
        <div className="vp-seek">
          <div className="vp-track" style={{ "--fill": `${share}%` }} />
          {lockedFrom < 100 && <div className="vp-locked" style={{ left: `${lockedFrom}%` }} title="Answer the questions to unlock the rest" />}
          {markers.map((marker) => (
            <span key={marker.at} className={`vp-marker${marker.done ? " done" : ""}`} style={{ left: `${marker.at * 100}%` }} title={marker.done ? "Questions passed" : "Questions appear here"} />
          ))}
          <input type="range" aria-label="Seek" min={0} max={duration || 0} step={0.05} value={Math.min(time, duration || 0)} onChange={(event) => seek(Number(event.target.value))} />
        </div>
        <button type="button" className="vp-btn" onClick={() => (video.current.muted = !video.current.muted)} aria-label={muted || volume === 0 ? "Unmute" : "Mute"}>
          {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
        <input className="vp-volume" type="range" aria-label="Volume" min={0} max={1} step={0.05} value={muted ? 0 : volume} onChange={(event) => { video.current.muted = false; video.current.volume = Number(event.target.value); }} />
        <button type="button" className="vp-btn vp-rate" aria-label="Playback speed" title="Playback speed" onClick={() => (video.current.playbackRate = SPEEDS[(SPEEDS.indexOf(rate) + 1) % SPEEDS.length])}>
          {rate}×
        </button>
        <button type="button" className="vp-btn" onClick={toggleFull} aria-label={full ? "Exit full screen" : "Full screen"}>
          {full ? <Minimize size={18} /> : <Maximize size={18} />}
        </button>
      </div>

      {children && <div className="vp-overlay">{children}</div>}
    </div>
  );
}
