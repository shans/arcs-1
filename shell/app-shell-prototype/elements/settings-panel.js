// code
import Xen from '../../components/xen/xen.js';
import Const from '../constants.js';
// elements
// strings
import IconStyle from '../../components/icons.css.js';
// globals
/* global shellPath */

const html = Xen.Template.html;
const template = html`

<style>
  ${IconStyle}
  :host {
    display: block;
    box-sizing: border-box;
    user-select: none;
    --avatar-size: 24px;
    --large-avatar-size: 40px;
  }
  section {
    display: block;
    box-sizing: border-box;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    padding: 0 16px;
    cursor: pointer;
  }
  section[bar] {
    height: 56px;
    display: flex;
    align-items: center;
  }
  section span {
    flex: 1
  }
  section[friends] {
    padding: 16px;
  }
  avatar {
    display: inline-block;
    height: var(--avatar-size);
    width: var(--avatar-size);
    min-width: var(--avatar-size);
    border-radius: 100%;
    border: 1px solid whitesmoke;
    background: gray center no-repeat;
    background-size: cover;
  }
  user-item {
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 8px 0;
  }
  user-item avatar {
    height: var(--large-avatar-size);
    width: var(--large-avatar-size);
    min-width: var(--large-avatar-size);
    margin-right: 16px;
  }
</style>

<section bar>
  <avatar title="{{avatar_title}}" style="{{avatar_style}}" on-click="_onSelectUser"></avatar>
  <span></span>
  <icon on-click="_onClose">chevron_right</icon>
</section>
<section bar>
  <span>Star this arc</span>
  <icon>star_border</icon>
</section>
<section bar on-click="_onToolsClick">
  <span>Toggle tools panel</span>
  <icon>business_center</icon>
</section>
<section bar on-click="_onCastClick">
  <span>Cast this arc</span>
  <icon>cast</icon>
</section>
<section bar on-click="_onProfileClick" style="{{profileStyle}}">
  <span>Use for suggestions</span>
  <icon>{{profileIcon}}</icon>
</section>
<section bar on-click="_onShareClick" style="{{shareStyle}}">
  <span>Use for friends' suggestions</span>
  <icon>{{shareIcon}}</icon>
</section>
<section friends>{{friends}}</section>
`;

const userTemplate = html`
  <user-item selected$="{{selected}}" on-click="_onSelect" key="{{key}}">
    <avatar style="{{style}}"></avatar> <name>{{name}}</name>
  </user-item>
`;

class SettingsPanel extends Xen.Base {
  get template() {
    return template;
  }
  static get observedAttributes() {
    return ['arc', 'open', 'friends', 'avatars', 'avatar_title', 'avatar_style', 'share'];
  }
  _render({arc, open, avatar_title, avatar_style, friends, avatars, share}, state, oldProps) {
    const {selected, isProfile, isShared} = state;
    const render = {
      avatar_title,
      avatar_style,
      profileIcon: isProfile ? 'check' : 'check_box_outline_blank',
      profileStyle: isProfile ? 'color: #1A73E8' : '',
      shareIcon: isShared ? 'check' : 'check_box_outline_blank',
      shareStyle: isShared ? 'color: #1A73E8' : ''
    };
    if (friends) {
      render.friends = {
        template: userTemplate,
        models: friends.map((friend, i) => this._renderUser(arc, selected, friend.rawData, avatars, i))
      };
    }
    if (oldProps.share !== share) {
      this._setState(this._shareStateToFlags(share));
    }
    return render;
  }
  _shareStateToFlags(share) {
    return {
      isShared: (share == Const.SHARE.friends),
      isProfile: (share == Const.SHARE.friends) || (share === Const.SHARE.self)
    };
  }
  _shareFlagsToShareState(isProfile, isShared) {
    return isShared ? Const.SHARE.friends : isProfile ? Const.SHARE.self : Const.SHARE.private;
  }
  _renderUser(arc, selected, user, avatars, i) {
    let avatar = user.avatar;
    if (arc && !avatar && avatars) {
      avatar = (avatars.find(a => a.owner === user.id) || Object).url;
      if (avatar) {
        avatar = arc._loader._resolve(avatar);
      }
    }
    if (!avatar) {
      avatar = `${shellPath}/assets/avatars/user (0).png`;
    }
    return {
      key: user.id,
      name: user.name,
      style: `background-image: url("${avatar}");`,
      selected: user.id === selected
    };
  }
  _onSelectUser() {
    this._fire('user');
  }
  _onCastClick() {
    this._fire('cast');
  }
  _onToolsClick() {
    this._fire('tools');
  }
  _onProfileClick() {
    let {isProfile, isShared} = this._state;
    isProfile = !isProfile;
    isShared = isProfile ? isShared : false;
    this._changeSharing(isProfile, isShared);
  }
  _onShareClick() {
    let {isProfile, isShared} = this._state;
    isShared = !isShared;
    isProfile = isShared ? true : isProfile;
    this._changeSharing(isProfile, isShared);
  }
  _changeSharing(isProfile, isShared) {
    const share = this._shareFlagsToShareState(isProfile, isShared);
    this._setState({isProfile, isShared, share});
  }
}

const log = Xen.logFactory('SettingsPanel', '#bb4d00');
customElements.define('settings-panel', SettingsPanel);