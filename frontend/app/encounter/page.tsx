'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { claimPatrolEncounter, releasePatrolEncounter } from '@/lib/api';

const SPRITE_BASE =
  'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home';

function CSSPokeball({ size = 240, style = {} }: { size?: number; style?: React.CSSProperties }) {
  const border = Math.round(size * 0.04);
  const band   = Math.round(size * 0.04);
  const btn    = Math.round(size * 0.22);
  const btnBorder = Math.round(size * 0.035);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `${border}px solid #111`,
      background: 'linear-gradient(to bottom, #e30000 50%, #fff 50%)',
      position: 'relative', overflow: 'hidden',
      boxShadow: '0 0 40px rgba(255,60,60,0.5), inset 0 3px 12px rgba(255,255,255,0.25)',
      flexShrink: 0,
      ...style,
    }}>
      {/* 中間黑帶 */}
      <div style={{
        position: 'absolute', left: 0,
        top: `calc(50% - ${band}px)`,
        width: '100%', height: band * 2, background: '#111',
      }} />
      {/* 中心按鈕 */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        width: btn, height: btn, borderRadius: '50%',
        background: '#f5f5f5',
        border: `${btnBorder}px solid #111`,
        zIndex: 1,
        boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.15)',
      }} />
    </div>
  );
}

const DEMO_POOL = [
  { id: 150, name: '超夢' },
  { id: 249, name: '洛奇亞' },
  { id: 384, name: '烈空坐' },
];

const TIER_TITLE: Record<string, string> = {
  legendary: '傳說寶可夢',
  normal: '野生寶可夢',
  luck: '幸運相遇',
  courage: '勇氣特別相遇',
};

// 固定星星位置
const STARS = Array.from({ length: 24 }, (_, i) => ({
  left: `${(i * 41 + 7) % 100}%`,
  top: `${(i * 29 + 11) % 100}%`,
  delay: `${((i * 0.37) % 2.8).toFixed(2)}s`,
  big: i % 5 === 0,
}));

const SPARKLES = [
  { x: -90, y: -80, delay: '0s' },
  { x: 90, y: -80, delay: '0.1s' },
  { x: -110, y: 20, delay: '0.2s' },
  { x: 110, y: 20, delay: '0.15s' },
  { x: -60, y: 100, delay: '0.25s' },
  { x: 60, y: 100, delay: '0.05s' },
  { x: 0, y: -110, delay: '0.3s' },
];

type Phase = 'shaking' | 'ready' | 'opening' | 'revealed';

function EncounterScreen() {
  const params = useSearchParams();
  const router = useRouter();
  const paramId = params.get('pokemonId');
  const paramName = params.get('pokemonName');
  const tier = params.get('tier') ?? 'normal';

  const [phase, setPhase] = useState<Phase>('shaking');
  const [claiming, setClaiming] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [pokemon, setPokemon] = useState(DEMO_POOL[0]);
  const [rockCount, setRockCount] = useState(0);

  useEffect(() => {
    if (paramId && paramName) {
      setPokemon({ id: Number(paramId), name: paramName });
    } else {
      setPokemon(DEMO_POOL[Math.floor(Math.random() * DEMO_POOL.length)]);
    }
  }, [paramId, paramName]);

  // 搖晃 3 次後進入 ready，每次間隔 1s
  useEffect(() => {
    if (phase !== 'shaking') return;
    if (rockCount >= 3) {
      const t = setTimeout(() => setPhase('ready'), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRockCount(c => c + 1), 900);
    return () => clearTimeout(t);
  }, [phase, rockCount]);

  const handleThrow = () => {
    setPhase('opening');
    setTimeout(() => setPhase('revealed'), 600);
  };

  const spriteUrl = `${SPRITE_BASE}/${pokemon.id}.png`;
  const isRevealed = phase === 'revealed';

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center select-none overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 50% 40%, #0d1b4b 0%, #050a1a 100%)' }}
    >
      {/* 背景星星 */}
      {STARS.map((s, i) => (
        <div
          key={i}
          className={`absolute rounded-full bg-white ${s.big ? 'w-1.5 h-1.5' : 'w-0.5 h-0.5'}`}
          style={{
            left: s.left,
            top: s.top,
            animation: `twinkle ${s.big ? 2 : 3}s ease-in-out infinite`,
            animationDelay: s.delay,
          }}
        />
      ))}

      {/* 揭曉後的光暈 */}
      {isRevealed && (
        <div
          className="absolute w-64 h-64 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(255,220,50,0.25) 0%, transparent 70%)',
            animation: 'revealPop 0.5s ease-out forwards',
          }}
        />
      )}

      {/* 標題文字 */}
      <div className="mb-8 text-center px-4" style={{ animation: 'slideUp 0.4s ease-out both' }}>
        {!isRevealed ? (
          <p className="font-pixel-title text-white text-xs leading-relaxed">
            {TIER_TITLE[tier] ?? '野生寶可夢'}{' '}
            <span className="text-yellow-300">???</span> 出現了！
          </p>
        ) : (
          <p
            className="font-pixel-title text-yellow-300 text-sm leading-relaxed"
            style={{ animation: 'slideUp 0.4s ease-out both' }}
          >
            {pokemon.name}
          </p>
        )}
      </div>

      {/* 中央：寶可球 或 寶可夢 */}
      <div className="relative flex items-center justify-center w-56 h-56">

        {/* 揭曉閃爍星星 */}
        {isRevealed && SPARKLES.map((sp, i) => (
          <div
            key={i}
            className="absolute text-yellow-300 text-lg pointer-events-none"
            style={{
              left: `calc(50% + ${sp.x}px)`,
              top: `calc(50% + ${sp.y}px)`,
              animation: `sparkle 0.6s ease-in-out ${sp.delay} both`,
            }}
          >
            ✦
          </div>
        ))}

        {/* 寶可球（搖晃 + 開啟階段） */}
        {!isRevealed && (
          <CSSPokeball
            key={phase === 'shaking' ? rockCount : phase}
            size={240}
            style={{
              animation:
                phase === 'shaking' && rockCount < 3
                  ? 'pokeballRock 0.7s ease-in-out'
                  : phase === 'opening'
                  ? 'pokeballOpen 0.5s ease-out forwards'
                  : 'none',
              animationFillMode: 'both',
            }}
          />
        )}

        {/* 寶可夢（揭曉後） */}
        {isRevealed && (
          <img
            src={spriteUrl}
            alt={pokemon.name}
            width={200}
            height={200}
            className="object-contain"
            style={{
              animation: 'revealPop 0.5s ease-out both, floatY 3s ease-in-out infinite 0.6s',
            }}
          />
        )}
      </div>

      {/* 地面線 */}
      <div className="w-48 h-px bg-gray-700 mt-2 mb-8" />

      {/* 搖晃計數點 */}
      {(phase === 'shaking' || phase === 'ready') && (
        <div className="flex gap-3 mt-2 mb-6">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={`w-3 h-3 rounded-full border-2 transition-colors duration-300 ${
                i < rockCount ? 'bg-red-500 border-red-500' : 'bg-transparent border-gray-500'
              }`}
            />
          ))}
        </div>
      )}

      {/* 投球按鈕 */}
      {phase === 'ready' && (
        <button
          onClick={handleThrow}
          className="px-10 py-4 bg-red-500 hover:bg-red-600 active:scale-95 text-white font-bold rounded-full text-base shadow-xl transition-all"
          style={{ animation: 'slideUp 0.4s ease-out both' }}
        >
          投出精靈球！
        </button>
      )}

      {/* 揭曉後 */}
      {isRevealed && (
        <div
          className="mt-2 text-center"
          style={{ animation: 'slideUp 0.5s ease-out 0.3s both' }}
        >
          <p className="text-green-400 font-bold text-lg mb-1">獲得了！</p>
          <p className="text-gray-400 text-sm mb-4">{pokemon.name} 加入你的冒險隊伍！</p>
          {paramId && !confirmRelease && (
            <div
              className="flex items-center justify-center gap-3"
              style={{ animation: 'slideUp 0.5s ease-out 0.5s both' }}
            >
              <button
                onClick={async () => {
                  if (claiming || releasing) return;
                  setClaiming(true);
                  try {
                    await claimPatrolEncounter();
                  } catch {
                    // 409 already claimed is fine; other errors — still navigate home
                  }
                  router.push('/');
                }}
                disabled={claiming || releasing}
                className="px-8 py-4 bg-green-500 hover:bg-green-600 active:scale-95 disabled:opacity-60 text-white font-bold rounded-full text-base shadow-xl transition-all"
              >
                {claiming ? '加入中…' : '✓ 加入圖鑑！'}
              </button>
              <button
                onClick={() => setConfirmRelease(true)}
                disabled={claiming || releasing}
                className="px-8 py-4 bg-red-500 hover:bg-red-600 active:scale-95 disabled:opacity-60 text-white font-bold rounded-full text-base shadow-xl transition-all"
              >
                💛 放生牠
              </button>
            </div>
          )}

          {paramId && confirmRelease && (
            <div
              className="flex flex-col items-center gap-3 rounded-2xl bg-white/10 px-5 py-4"
              style={{ animation: 'slideUp 0.3s ease-out both' }}
            >
              <p className="text-yellow-200 text-sm font-bold">
                確定放生 {pokemon.name} 嗎？
              </p>
              <p className="text-gray-400 text-xs">放生後今天就不能再收服牠囉</p>
              <div className="flex gap-3 mt-1">
                <button
                  onClick={async () => {
                    if (releasing) return;
                    setReleasing(true);
                    try {
                      await releasePatrolEncounter();
                    } catch {
                      // 409/404：今日已處理也無妨，照樣回首頁
                    }
                    router.push('/');
                  }}
                  disabled={releasing}
                  className="px-6 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 disabled:opacity-60 text-white font-bold rounded-full text-sm shadow-lg transition-all"
                >
                  {releasing ? '放生中…' : '💛 確定放生'}
                </button>
                <button
                  onClick={() => setConfirmRelease(false)}
                  disabled={releasing}
                  className="px-6 py-3 bg-white/20 hover:bg-white/30 active:scale-95 disabled:opacity-60 text-white font-bold rounded-full text-sm transition-all"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EncounterPage() {
  return (
    <Suspense>
      <EncounterScreen />
    </Suspense>
  );
}
