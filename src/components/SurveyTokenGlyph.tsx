export default function SurveyTokenGlyph() {
  return (
    <>
      <circle className="survey-token-outer" cx="0" cy="0" r="18" />
      <circle className="survey-token-inner" cx="0" cy="0" r="13" />
      <line className="survey-token-cross" x1="0" x2="0" y1="-15" y2="15" />
      <line className="survey-token-cross" x1="-15" x2="15" y1="0" y2="0" />
      <path
        className="survey-token-cross"
        d="M 0 -14 L 4 -4 L 0 -6 L -4 -4 Z"
        fill="rgba(122, 83, 18, 0.82)"
        stroke="none"
      />
      <path
        className="survey-token-core"
        d="M 0 -11 L 3 -3 L 0 -5 L -3 -3 Z"
      />
      <path
        className="survey-token-cross"
        d="M 0 14 L 4 4 L 0 6 L -4 4 Z"
        fill="rgba(122, 83, 18, 0.82)"
        stroke="none"
      />
      <circle className="survey-token-core" cx="0" cy="0" r="3.2" />
    </>
  );
}
