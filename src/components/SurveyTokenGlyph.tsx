export default function SurveyTokenGlyph() {
  return (
    <>
      <circle className="survey-token-outer" cx="0" cy="0" r="18" />
      <circle className="survey-token-inner" cx="0" cy="0" r="11" />
      <circle className="survey-token-core" cx="0" cy="0" r="5" />
      <line className="survey-token-cross" x1="0" x2="0" y1="-15" y2="-9" />
      <line className="survey-token-cross" x1="0" x2="0" y1="9" y2="15" />
      <line className="survey-token-cross" x1="-15" x2="-9" y1="0" y2="0" />
      <line className="survey-token-cross" x1="9" x2="15" y1="0" y2="0" />
    </>
  );
}
