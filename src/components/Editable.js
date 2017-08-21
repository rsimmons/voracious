import React, { PureComponent } from 'react';

import './Editable.css';

export default class Editable extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      editing: false,
    };
  }

  componentDidUpdate() {
    if (this.inputElem) {
      this.inputElem.focus();
      this.inputElem.select();
    }
  }

  handleClickEdit = (e) => {
    e.preventDefault();
    this.setState({editing: true});
  }

  handleClickSet = (e) => {
    e.preventDefault();
    this.props.onUpdate(this.inputElem.value);
    this.setState({editing: false});
  }

  handleClickCancel = (e) => {
    e.preventDefault();
    this.setState({editing: false});
  }

  render() {
    const { value } = this.props;

    return (
      <span className="Editable">
        {this.state.editing ? (
          <span>
            <input type="text" defaultValue={value} ref={el => { this.inputElem = el }}/>
            <button onClick={this.handleClickSet}>Set</button>
            <button onClick={this.handleClickCancel}>Cancel</button>
          </span>
        ) : (
          <span>{value} <button onClick={this.handleClickEdit}>Edit</button></span>
        )}
      </span>
    );
  }
}
