import React from 'react';
import { Language, NonoMood, OfficialCharacterId } from '../types/nonoland';
import { CharacterActor } from './CharacterCast';

interface NonoCharacterProps {
  characterId?: OfficialCharacterId;
  mood?: NonoMood;
  scarfColor?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  hat?: string;
  accessory?: string;
  speechBubble?: string;
  language?: Language;
  onTap?: () => void;
  interactive?: boolean;
}

export const NonoCharacter: React.FC<NonoCharacterProps> = ({
  characterId = 'nono',
  mood = 'idle',
  scarfColor = '#8054D9',
  size = 'md',
  hat = 'none',
  accessory = 'none',
  speechBubble,
  language = 'ar',
  onTap,
  interactive = true,
}) => {
  return (
    <CharacterActor
      characterId={characterId}
      mood={mood}
      accentColor={scarfColor}
      size={size}
      hat={hat}
      accessory={accessory}
      speechBubble={speechBubble}
      language={language}
      onTap={onTap}
      interactive={interactive}
    />
  );
};

