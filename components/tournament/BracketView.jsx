import React, { memo } from 'react';
import { CupBracketView } from './CupBracketView.jsx';
import { CUP_IDS } from '../../utils/bracketModel.js';

// Copa de Oro. El layout y los conectores son los de CupBracketView (compartido con la Copa de Plata).
export const BracketView = memo(function BracketView({ localData, isEditing, getTeamLogo, updateGeneric }) {
  return (
    <CupBracketView
      cupId={CUP_IDS.ORO}
      localData={localData}
      isEditing={isEditing}
      getTeamLogo={getTeamLogo}
      updateGeneric={updateGeneric}
    />
  );
});

export default BracketView;
