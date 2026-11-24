import React, { useEffect, useState } from 'react';
import {
  loadDs1IconData,
  findIconPosition,
  gestureIconPosition,
  ICON_CELL_WIDTH,
  ICON_CELL_HEIGHT,
  type Ds1IconData,
  type IconPosition,
} from '../lib/itemIcons';

let cachedData: Ds1IconData | null = null;

function useIconData(): Ds1IconData | null {
  const [data, setData] = useState<Ds1IconData | null>(cachedData);
  useEffect(() => {
    if (cachedData) return;
    loadDs1IconData().then((d) => {
      cachedData = d;
      setData(d);
    });
  }, []);
  return data;
}

/** Renders whatever sprite sheet cell `position` points at, scaled to `size` wide. */
const IconSprite: React.FC<{ data: Ds1IconData | null; position: IconPosition | null; size: number }> = ({
  data,
  position,
  size,
}) => {
  const height = Math.round(size * (ICON_CELL_HEIGHT / ICON_CELL_WIDTH));

  if (!data || !position) {
    return <div className="item-icon item-icon-empty" style={{ width: size, height }} />;
  }

  const scale = size / ICON_CELL_WIDTH;
  const sheetSize = data.meta.sheetPixelSize[position.sheet];

  return (
    <div className="item-icon" style={{ width: size, height }}>
      <div
        className="item-icon-sprite"
        style={{
          width: size,
          height,
          backgroundImage: `url(${data.meta.sheetFiles[position.sheet]})`,
          backgroundPosition: `${-position.x * scale}px ${-position.y * scale}px`,
          backgroundSize: `${sheetSize.width * scale}px ${sheetSize.height * scale}px`,
        }}
      />
    </div>
  );
};

interface ItemIconProps {
  typeNibble: number;
  itemId: number;
  /** Rendered width in px; height follows the sheet's 164:184 cell ratio. */
  size?: number;
}

/** A single item's icon, cropped from its sprite sheet. Renders a blank slot if none is found. */
export const ItemIcon: React.FC<ItemIconProps> = ({ typeNibble, itemId, size = 32 }) => {
  const data = useIconData();
  const position = findIconPosition(data, typeNibble, itemId);
  return <IconSprite data={data} position={position} size={size} />;
};

interface GestureIconProps {
  /** The gesture's bit index (0 = Point Forward ... 14 = Praise the Sun). */
  index: number;
  size?: number;
}

/** A single gesture's icon, cropped from the same Icon30 sheet as the magic icons. */
export const GestureIcon: React.FC<GestureIconProps> = ({ index, size = 32 }) => {
  const data = useIconData();
  return <IconSprite data={data} position={gestureIconPosition(index)} size={size} />;
};
