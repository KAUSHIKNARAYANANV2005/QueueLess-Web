import React from 'react';

const GlassContainer = ({
  children,
  className = '',
  style = {},
  blur = 16,
  opacity = 0.45,
  borderColor = 'rgba(255, 255, 255, 0.35)',
  borderRadius = '16px',
  ...props
}) => {
  const customStyle = {
    backdropFilter: `blur(${blur}px)`,
    WebkitBackdropFilter: `blur(${blur}px)`,
    borderRadius,
    ...style
  };

  return (
    <div
      className={`glass-panel ${className}`}
      style={customStyle}
      {...props}
    >
      {children}
    </div>
  );
};

export default GlassContainer;
