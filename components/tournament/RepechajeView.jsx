import React, { memo } from 'react';
import { CupBracketView } from './CupBracketView.jsx';
import { CUP_IDS } from '../../utils/bracketModel.js';

// Copa de Plata (repechaje). El layout y los conectores son los de CupBracketView (compartido con la Copa de Oro).
export const RepechajeView = memo(function RepechajeView({ localData, isEditing, getTeamLogo, updateGeneric }) {
  return (
    <CupBracketView
      cupId={CUP_IDS.PLATA}
      localData={localData}
      isEditing={isEditing}
      getTeamLogo={getTeamLogo}
      updateGeneric={updateGeneric}
    />
  );
});

export default RepechajeView;
