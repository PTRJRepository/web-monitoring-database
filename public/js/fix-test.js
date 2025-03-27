// Test event handler closing
bubble.addEventListener('click', function() {
  try {
    if (activeBubbles.length > 0) {
      try {
        // Some code
      } catch (error) {
        console.error('Error');
      }
    } else {
      try {
        // Some code
      } catch (error) {
        // Fallback
      }
    }
  } catch (error) {
    console.error('Error');
  }
}); // This line had syntax issue

console.log('Code is valid'); 