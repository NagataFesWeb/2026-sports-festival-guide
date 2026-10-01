"use client";

// 演出は常に有効。旧保存設定やOS設定による切り替えは行わない。
export function useSiteMotion() { return { enabled: true, ready: true }; }
export function isMotionReduced(): boolean { return false; }
