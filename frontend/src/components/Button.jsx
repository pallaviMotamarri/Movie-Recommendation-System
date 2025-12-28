import React from 'react';

const Button = ({
  text = "Get Started",
  text_font_size = "14px",
  text_font_family = "Poppins",
  text_font_weight = "600",
  text_line_height = "21px",
  text_letter_spacing = "5px",
  text_text_align = "center",
  text_text_transform = "uppercase",
  text_color = "#0f1729",
  fill_background = "linear-gradient(90deg, #fb9623 0%, #ff8a4c 100%)",
  border_border_radius = "26px",
  effect_box_shadow = "0px 0px 30px #ff8a4c72",
  padding = "16px 34px 16px 50px",
  disabled = false,
  onClick,
  type = "button",
  ...props
}) => {
  const buttonStyles = {
    fontSize: text_font_size,
    fontFamily: text_font_family,
    fontWeight: text_font_weight,
    lineHeight: text_line_height,
    letterSpacing: text_letter_spacing,
    textAlign: text_text_align,
    textTransform: text_text_transform,
    color: text_color,
    background: fill_background,
    borderRadius: border_border_radius,
    boxShadow: effect_box_shadow,
    padding: padding,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    transition: 'all 0.2s ease',
  };

  const handleClick = (event) => {
    if (disabled) return;
    if (typeof onClick === 'function') {
      onClick(event);
    }
  };

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={handleClick}
      style={buttonStyles}
      className="custom-button"
      aria-disabled={disabled}
      {...props}
    >
      {text}
    </button>
  );
};

export default Button;